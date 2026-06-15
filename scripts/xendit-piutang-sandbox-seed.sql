-- Simulasi data piutang untuk uji Xendit VA (sandbox).
-- Jalankan di Supabase Dashboard → SQL Editor.
--
-- Membuat:
--   1 aktivitas penjualan "Klien Demo Xendit VA" — total Rp 5.000.000
--   1 pembayaran cicilan Rp 750.000 (transfer, belum diverifikasi) → Generate VA di /incomes/piutang
--
-- Default org: Synckerja (sesuaikan v_org jika perlu).

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_user uuid;
  v_activity_id uuid;
  v_payment_id uuid;
  v_marker text := '[XENDIT_SANDBOX]';
BEGIN
  SELECT ur.user_id INTO v_user
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
    AND ur.role = 'owner'
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  IF v_user IS NULL THEN
    SELECT p.user_id INTO v_user
    FROM public.profiles p
    WHERE p.active_organization_id = v_org
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found for organization %', v_org;
  END IF;

  INSERT INTO public.sales_activities (
    organization_id,
    client_name,
    client_phone,
    client_email,
    activity_type,
    status,
    date,
    description,
    payment_method,
    created_by
  ) VALUES (
    v_org,
    'Klien Demo Xendit VA',
    '081234567890',
    'klien.demo.xendit@example.com',
    'Closing',
    'Won',
    CURRENT_DATE,
    v_marker || ' Simulasi piutang untuk uji Virtual Account Xendit.',
    'transfer',
    v_user
  )
  RETURNING id INTO v_activity_id;

  INSERT INTO public.sales_activity_items (
    sales_activity_id,
    organization_id,
    service_name,
    quantity,
    unit_price
  ) VALUES (
    v_activity_id,
    v_org,
    v_marker || ' Paket ERP (demo)',
    1,
    5000000
  );

  INSERT INTO public.sales_activity_payments (
    sales_activity_id,
    organization_id,
    payment_amount,
    payment_date,
    payment_method,
    payment_type,
    notes,
    created_by,
    transfer_verification_status
  ) VALUES (
    v_activity_id,
    v_org,
    750000,
    CURRENT_DATE,
    'bank_transfer',
    'installment',
    v_marker || ' Cicilan 1 — bayar via Xendit VA',
    v_user,
    'unchecked'
  )
  RETURNING id INTO v_payment_id;

  RAISE NOTICE '--- Xendit piutang seed OK ---';
  RAISE NOTICE 'Organization: %', v_org;
  RAISE NOTICE 'Sales activity ID: %', v_activity_id;
  RAISE NOTICE 'Payment ID (untuk Generate VA): %', v_payment_id;
  RAISE NOTICE 'Buka /incomes/piutang → cari "Klien Demo Xendit VA" → drawer → Generate VA';
END $$;

-- Verifikasi cepat (opsional, jalankan setelah blok di atas):
-- SELECT sa.id, sa.client_name, sa.total_amount, sa.total_paid_amount, sa.payment_status
-- FROM public.sales_activities sa
-- WHERE sa.client_name = 'Klien Demo Xendit VA'
-- ORDER BY sa.created_at DESC LIMIT 1;

-- Hapus data simulasi (opsional):
-- DELETE FROM public.sales_activities
-- WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
--   AND client_name = 'Klien Demo Xendit VA';
