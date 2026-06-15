-- Seed purchase_requests untuk uji Approval + Payment Process (+ Pay via Brick).
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Jalankan di Supabase SQL Editor.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_mandiri_bank uuid := '767c9135-fb63-4564-93d3-8672cd278d77'; -- Rekening Bisnis MANDIRI (linked Brick)
  v_user uuid;
  v_marker text := '[PAYMENT_SANDBOX]';
  v_id uuid;
BEGIN
  SELECT ur.user_id INTO v_user
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
    AND ur.role IN ('owner', 'admin')
  ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END, ur.created_at NULLS LAST
  LIMIT 1;

  IF v_user IS NULL THEN
    SELECT ur.user_id INTO v_user
    FROM public.user_roles ur
    WHERE ur.organization_id = v_org
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found for org %', v_org;
  END IF;

  -- -------------------------------------------------------------------------
  -- 1) Approval queue — Expenses → Approvals
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Pending approval — vendor hosting'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id,
      requester_id,
      requester_name,
      request_type,
      purchase_type,
      request_title,
      amount_idr,
      description,
      company_benefit,
      vendor_name,
      vendor_bank_code,
      vendor_bank_account_number,
      vendor_bank_account_holder,
      status,
      submitted_at,
      created_by,
      payment_status
    ) VALUES (
      v_org,
      v_user,
      'QA Requester',
      'purchase',
      'Service',
      v_marker || ' Pending approval — vendor hosting',
      750000,
      'Langganan hosting tahunan untuk staging.',
      'Menjaga uptime environment demo.',
      'PT Vendor Hosting QA',
      'MANDIRI',
      '12345678',
      'PROD ONLY',
      'pending_approval',
      now(),
      v_user,
      'pending'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Submitted — alat kantor'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id,
      requester_id,
      requester_name,
      request_type,
      purchase_type,
      request_title,
      amount_idr,
      description,
      company_benefit,
      vendor_name,
      status,
      submitted_at,
      created_by,
      payment_status
    ) VALUES (
      v_org,
      v_user,
      'QA Requester',
      'purchase',
      'Physical Item',
      v_marker || ' Submitted — alat kantor',
      325000,
      'Mouse + keyboard untuk tim QA.',
      'Produktivitas kerja harian.',
      'Toko ATK QA',
      'submitted',
      now(),
      v_user,
      'pending'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- 2) Payment process — Expenses → Payment process (status approved, belum paid)
  --    Sumber dana: rekening Mandiri linked Brick (bank_account_id)
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Approved — vendor utama (Brick)'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id,
      requester_id,
      requester_name,
      request_type,
      purchase_type,
      request_title,
      amount_idr,
      description,
      company_benefit,
      vendor_name,
      vendor_bank_code,
      vendor_bank_account_number,
      vendor_bank_account_holder,
      status,
      submitted_at,
      approved_at,
      approved_by,
      approved_by_user_id,
      approved_by_name,
      bank_account_id,
      created_by,
      payment_status
    ) VALUES (
      v_org,
      v_user,
      'QA Requester',
      'purchase',
      'Service',
      v_marker || ' Approved — vendor utama (Brick)',
      10000,
      'Invoice vendor utama — uji Pay via Brick.',
      'Operasional bisnis inti.',
      'PT Vendor Utama QA',
      'MANDIRI',
      '12345678',
      'PROD ONLY',
      'approved',
      now() - interval '3 days',
      now() - interval '2 days',
      v_user,
      v_user,
      'QA Approver',
      v_mandiri_bank,
      v_user,
      'pending'
    )
    RETURNING id INTO v_id;
    RAISE NOTICE 'Created approved payment-process row: %', v_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Approved — vendor kecil'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id,
      requester_id,
      requester_name,
      request_type,
      purchase_type,
      request_title,
      amount_idr,
      description,
      company_benefit,
      vendor_name,
      vendor_bank_code,
      vendor_bank_account_number,
      vendor_bank_account_holder,
      status,
      submitted_at,
      approved_at,
      approved_by_user_id,
      approved_by_name,
      bank_account_id,
      created_by,
      payment_status
    ) VALUES (
      v_org,
      v_user,
      'QA Requester',
      'purchase',
      'Service',
      v_marker || ' Approved — vendor kecil',
      150000,
      'Biaya kurir dokumen.',
      'Kelancaran administrasi.',
      'Kurir QA',
      'BRI',
      '12345678',
      'PROD ONLY',
      'approved',
      now() - interval '2 days',
      now() - interval '1 day',
      v_user,
      'QA Approver',
      v_mandiri_bank,
      v_user,
      'pending'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Approved — vendor BCA'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id,
      requester_id,
      requester_name,
      request_type,
      purchase_type,
      request_title,
      amount_idr,
      description,
      company_benefit,
      vendor_name,
      vendor_bank_code,
      vendor_bank_account_number,
      vendor_bank_account_holder,
      status,
      submitted_at,
      approved_at,
      approved_by_user_id,
      approved_by_name,
      bank_account_id,
      created_by,
      payment_status
    ) VALUES (
      v_org,
      v_user,
      'QA Requester',
      'purchase',
      'Service',
      v_marker || ' Approved — vendor BCA',
      3187500,
      'Jasa konsultan bulanan.',
      'Dukungan keputusan operasional.',
      'Konsultan QA',
      'BCA',
      '12345678',
      'PROD ONLY',
      'approved',
      now() - interval '5 days',
      now() - interval '4 days',
      v_user,
      'QA Approver',
      v_mandiri_bank,
      v_user,
      'pending'
    );
  END IF;

  RAISE NOTICE '--- Payment process / approval seed OK ---';
  RAISE NOTICE 'Approvals: cari judul dengan prefix %', v_marker;
  RAISE NOTICE 'Payment process: status=approved, paid_at IS NULL';
  RAISE NOTICE 'Brick: gunakan Pay via Brick pada request "vendor utama"';
END $$;

-- Verifikasi: Approval queue
SELECT id, request_title, status, amount_idr, submitted_at
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title LIKE '[PAYMENT_SANDBOX]%'
  AND status IN ('pending_approval', 'submitted')
ORDER BY submitted_at DESC;

-- Verifikasi: Payment process (tombol Pay via Brick / Xendit)
SELECT
  pr.id,
  pr.request_title,
  pr.status,
  pr.payment_status,
  pr.amount_idr,
  pr.paid_at,
  pr.vendor_bank_code,
  pr.vendor_bank_account_number,
  ba.name AS source_bank_account,
  ba.brick_link_status
FROM public.purchase_requests pr
LEFT JOIN public.bank_accounts ba ON ba.id = pr.bank_account_id
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.request_title LIKE '[PAYMENT_SANDBOX]%'
  AND pr.status = 'approved'
  AND pr.paid_at IS NULL
ORDER BY pr.approved_at DESC;
