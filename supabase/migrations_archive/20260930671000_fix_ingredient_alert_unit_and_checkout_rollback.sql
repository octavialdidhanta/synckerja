-- 1) Inventory alert trigger used catalog_ingredients.unit (does not exist).
--    Column is unit_code. The bad SELECT aborted recipe stock updates in the
--    same transaction, so Pustaka did not decrement after POS sales.
-- 2) Checkout rollback deleted sales_activities (CASCADE payments) while
--    income_transactions still referenced the payment (ON DELETE RESTRICT).

CREATE OR REPLACE FUNCTION public.trg_catalog_ingredient_outlets_inventory_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean := true;
  v_cross text;
  v_track boolean := false;
  v_name text;
  v_unit text;
  v_outlet_name text;
  v_txid bigint := txid_current();
BEGIN
  IF NEW.in_stock IS NOT DISTINCT FROM OLD.in_stock THEN
    RETURN NEW;
  END IF;

  IF public.inventory_alert_status_from_stock(
       NEW.in_stock, NEW.alert_enabled, NEW.alert_at
     ) IS NULL THEN
    DELETE FROM public.operational_inventory_alert_cooldown
    WHERE organization_id = NEW.organization_id
      AND outlet_id = NEW.outlet_id
      AND ingredient_id = NEW.ingredient_id;
    RETURN NEW;
  END IF;

  v_cross := public.did_cross_inventory_alert_threshold(
    OLD.in_stock,
    NEW.in_stock,
    NEW.alert_enabled,
    NEW.alert_at
  );
  IF v_cross IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.inventory_alerts_enabled, true) INTO v_enabled
  FROM public.operational_email_notification_settings s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(i.track_inventory, false), COALESCE(i.name, 'Ingredient'), COALESCE(i.unit_code, '')
  INTO v_track, v_name, v_unit
  FROM public.catalog_ingredients i
  WHERE i.id = NEW.ingredient_id;

  IF NOT v_track THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(o.name, 'Outlet') INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = NEW.outlet_id;

  IF EXISTS (
    SELECT 1
    FROM public.operational_inventory_alert_cooldown c
    WHERE c.organization_id = NEW.organization_id
      AND c.outlet_id = NEW.outlet_id
      AND c.ingredient_id = NEW.ingredient_id
      AND c.status = v_cross
      AND c.sent_on_date = public.inventory_alert_wib_today()
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.operational_inventory_alert_staging (
    txid,
    organization_id,
    outlet_id,
    ingredient_id,
    ingredient_name,
    unit,
    outlet_name,
    status,
    in_stock,
    alert_at
  )
  VALUES (
    v_txid,
    NEW.organization_id,
    NEW.outlet_id,
    NEW.ingredient_id,
    v_name,
    v_unit,
    COALESCE(v_outlet_name, 'Outlet'),
    v_cross,
    NEW.in_stock,
    NEW.alert_at
  );

  INSERT INTO public.operational_inventory_alert_tx_flush (txid)
  VALUES (v_txid)
  ON CONFLICT (txid) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_catalog_ingredient_outlets_inventory_alert() IS
  'Stage inventory alert crossings using catalog_ingredients.unit_code; deferred flush batches one email per transaction.';

CREATE OR REPLACE FUNCTION public.rollback_store_checkout_sales_activity(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_before numeric;
  v_after numeric;
BEGIN
  IF p_activity_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_activities sa
    WHERE sa.id = p_activity_id
      AND sa.organization_id IN (SELECT public.user_organization_ids())
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT it.id, it.organization_id, it.bank_account_id, it.amount, it.deposit_confirmed_at
    FROM public.income_transactions it
    WHERE it.sales_activity_payment_id IN (
      SELECT sap.id
      FROM public.sales_activity_payments sap
      WHERE sap.sales_activity_id = p_activity_id
    )
  LOOP
    BEGIN
      PERFORM public.delete_bank_transfer_by_income_transaction(r.id);
    EXCEPTION
      WHEN OTHERS THEN
        IF position('NOT_BANK_TRANSFER_INCOME' in SQLERRM) = 0 THEN
          RAISE;
        END IF;

        IF r.deposit_confirmed_at IS NOT NULL
           AND r.bank_account_id IS NOT NULL
           AND COALESCE(r.amount, 0) > 0 THEN
          SELECT balance INTO v_before
          FROM public.bank_account_balances
          WHERE bank_account_id = r.bank_account_id
            AND organization_id = r.organization_id
          FOR UPDATE;

          IF FOUND THEN
            v_after := COALESCE(v_before, 0) - COALESCE(r.amount, 0);
            UPDATE public.bank_account_balances
            SET balance = v_after, updated_at = now()
            WHERE bank_account_id = r.bank_account_id
              AND organization_id = r.organization_id;

            INSERT INTO public.bank_account_balance_history (
              bank_account_id, organization_id, transaction_type, transaction_id,
              amount, balance_before, balance_after, description, created_by
            ) VALUES (
              r.bank_account_id,
              r.organization_id,
              'income',
              r.id,
              -COALESCE(r.amount, 0),
              COALESCE(v_before, 0),
              v_after,
              'Store checkout rollback',
              auth.uid()
            );
          END IF;
        END IF;

        DELETE FROM public.income_transactions WHERE id = r.id;
    END;
  END LOOP;

  DELETE FROM public.income_transactions
  WHERE sales_activity_payment_id IN (
    SELECT sap.id
    FROM public.sales_activity_payments sap
    WHERE sap.sales_activity_id = p_activity_id
  );

  DELETE FROM public.sales_activities WHERE id = p_activity_id;
END;
$$;

COMMENT ON FUNCTION public.rollback_store_checkout_sales_activity(uuid) IS
  'Undo a failed store/POS checkout: remove linked income then the sales activity (and cascaded payments).';

REVOKE ALL ON FUNCTION public.rollback_store_checkout_sales_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_store_checkout_sales_activity(uuid) TO authenticated;
