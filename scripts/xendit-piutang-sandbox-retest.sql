-- Reset + siapkan cicilan baru untuk uji ulang piutang VA Xendit (sandbox).
-- Org: Synckerja default test org.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_user uuid;
  v_activity_id uuid;
  v_payment_id uuid;
  v_marker text := '[XENDIT_SANDBOX_RETEST]';
BEGIN
  SELECT ur.user_id INTO v_user
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org AND ur.role = 'owner'
  LIMIT 1;

  IF v_user IS NULL THEN
    SELECT p.user_id INTO v_user FROM public.profiles p
    WHERE p.active_organization_id = v_org LIMIT 1;
  END IF;

  -- Opsi: hapus data demo lama (VA + piutang demo sebelumnya)
  DELETE FROM public.xendit_payment_requests xpr
  WHERE xpr.organization_id = v_org
    AND xpr.sales_activity_payment_id IN (
      SELECT sap.id FROM public.sales_activity_payments sap
      JOIN public.sales_activities sa ON sa.id = sap.sales_activity_id
      WHERE sa.client_name = 'Klien Demo Xendit VA'
    );

  DELETE FROM public.income_transactions it
  WHERE it.organization_id = v_org
    AND it.sales_activity_payment_id IN (
      SELECT sap.id FROM public.sales_activity_payments sap
      JOIN public.sales_activities sa ON sa.id = sap.sales_activity_id
      WHERE sa.client_name = 'Klien Demo Xendit VA'
    );

  DELETE FROM public.sales_activities
  WHERE organization_id = v_org AND client_name = 'Klien Demo Xendit VA';

  -- Buat skenario baru dari nol
  INSERT INTO public.sales_activities (
    organization_id, client_name, client_phone, client_email,
    activity_type, status, date, description, payment_method, created_by
  ) VALUES (
    v_org, 'Klien Demo Xendit VA', '081234567890', 'klien.demo.xendit@example.com',
    'Closing', 'Won', CURRENT_DATE,
    v_marker || ' Uji ulang penerimaan piutang via VA.',
    'transfer', v_user
  )
  RETURNING id INTO v_activity_id;

  INSERT INTO public.sales_activity_items (
    sales_activity_id, organization_id, service_name, quantity, unit_price
  ) VALUES (v_activity_id, v_org, v_marker || ' Paket ERP', 1, 5000000);

  INSERT INTO public.sales_activity_payments (
    sales_activity_id, organization_id, payment_amount, payment_date,
    payment_method, payment_type, notes, created_by, transfer_verification_status
  ) VALUES (
    v_activity_id, v_org, 750000, CURRENT_DATE,
    'bank_transfer', 'installment',
    v_marker || ' Cicilan 1 — uji ulang VA',
    v_user, 'unchecked'
  )
  RETURNING id INTO v_payment_id;

  RAISE NOTICE 'Retest ready. Activity: % | Payment (Generate VA): %', v_activity_id, v_payment_id;
END $$;
