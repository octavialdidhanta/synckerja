-- Simulasi piutang + income pending untuk uji Brick mutasi (org Synckerja).
-- Cocokkan nominal dengan VA Brick Close Mandiri (default Rp 5.000.000).
-- Jalankan di Supabase SQL Editor sebelum refresh mutasi.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_mandiri_bank uuid := '767c9135-fb63-4564-93d3-8672cd278d77'; -- Rekening Bisnis MANDIRI
  v_user uuid;
  v_activity_id uuid;
  v_payment_id uuid;
  v_income_id uuid;
  v_marker text := '[BRICK_SANDBOX]';
  v_amount numeric := 5000000;
BEGIN
  SELECT ur.user_id INTO v_user
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org AND ur.role = 'owner'
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No owner user for org %', v_org;
  END IF;

  INSERT INTO public.sales_activities (
    organization_id, client_name, client_phone, client_email,
    activity_type, status, date, description, payment_method, created_by
  ) VALUES (
    v_org, 'Klien Demo Brick VA', '081298765432', 'klien.demo.brick@example.com',
    'Closing', 'Won', CURRENT_DATE,
    v_marker || ' Piutang untuk uji mutasi Brick Mandiri Rp 5jt.',
    'transfer', v_user
  )
  RETURNING id INTO v_activity_id;

  INSERT INTO public.sales_activity_items (
    sales_activity_id, organization_id, service_name, quantity, unit_price
  ) VALUES (
    v_activity_id, v_org, v_marker || ' Paket (demo)', 1, v_amount
  );

  INSERT INTO public.sales_activity_payments (
    sales_activity_id, organization_id, payment_amount, payment_date,
    payment_method, payment_type, notes, created_by, transfer_verification_status
  ) VALUES (
    v_activity_id, v_org, v_amount, CURRENT_DATE,
    'bank_transfer', 'installment',
    v_marker || ' Cicilan 1 — cocokkan dengan VA Brick Mandiri',
    v_user, 'unchecked'
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.income_transactions (
    organization_id, user_id, created_by,
    transaction_date, amount, customer_name, payment_method,
    bank_account_id, status, sales_activity_payment_id, description
  ) VALUES (
    v_org, v_user, v_user,
    CURRENT_DATE, v_amount, 'Klien Demo Brick VA', 'bank_transfer',
    v_mandiri_bank, 'pending', v_payment_id,
    v_marker || ' Menunggu konfirmasi deposit via Brick mutasi'
  )
  RETURNING id INTO v_income_id;

  RAISE NOTICE '--- Brick piutang seed OK ---';
  RAISE NOTICE 'Payment ID: %', v_payment_id;
  RAISE NOTICE 'Income ID (pending): %', v_income_id;
  RAISE NOTICE 'Bank: Rekening Bisnis MANDIRI, amount Rp %', v_amount;
  RAISE NOTICE 'Langkah: VA Brick COMPLETED → Refresh mutasi → konfirmasi match';
END $$;
