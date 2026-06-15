-- Seed baru untuk /expenses/approvals (batch v2 — fresh pending queue).
-- Termasuk expense_type_id, expense_category_id, gateway_wallet_provider (Xendit/Brick).
--
-- Org default QA: 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Marker: [APPROVALS_SANDBOX_v2]
-- Jalankan di Supabase SQL Editor (service role / postgres).
--
-- Idempotent: hapus baris marker v2 lalu insert ulang.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_mandiri_bank uuid := '767c9135-fb63-4564-93d3-8672cd278d77';
  v_marker text := '[APPROVALS_SANDBOX_v2]';
  v_requester uuid;
  v_approver uuid;
  v_expense_type_id uuid;
  v_service_category_id uuid;
  v_physical_category_id uuid;
  v_debt_id uuid;
BEGIN
  -- Hapus batch v2 sebelumnya (aman untuk re-run)
  DELETE FROM public.purchase_requests
  WHERE organization_id = v_org
    AND request_title LIKE v_marker || '%';

  SELECT ur.user_id INTO v_requester
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  SELECT ur.user_id INTO v_approver
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
    AND ur.role IN ('owner', 'admin')
  ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END, ur.created_at NULLS LAST
  LIMIT 1;

  IF v_requester IS NULL OR v_approver IS NULL THEN
    RAISE EXCEPTION 'No user_roles found for org %. Set v_org to your active organization.', v_org;
  END IF;

  SELECT id INTO v_expense_type_id
  FROM public.expense_types
  WHERE organization_id = v_org AND is_active = true
  ORDER BY is_default DESC, created_at
  LIMIT 1;

  IF v_expense_type_id IS NULL THEN
    INSERT INTO public.expense_types (organization_id, name, description, is_active, is_default)
    VALUES (v_org, 'Operasional', 'Pengeluaran operasional harian (QA seed v2)', true, true)
    RETURNING id INTO v_expense_type_id;
  END IF;

  SELECT id INTO v_service_category_id
  FROM public.expense_categories
  WHERE organization_id = v_org
    AND expense_type_id = v_expense_type_id
    AND is_active = true
    AND name ILIKE '%jasa%'
  LIMIT 1;

  IF v_service_category_id IS NULL THEN
    INSERT INTO public.expense_categories (
      organization_id, expense_type_id, name, description, is_active, is_default
    ) VALUES (
      v_org, v_expense_type_id, 'Jasa & Vendor', 'Vendor, kurir, konsultan (QA seed v2)', true, true
    )
    RETURNING id INTO v_service_category_id;
  END IF;

  SELECT id INTO v_physical_category_id
  FROM public.expense_categories
  WHERE organization_id = v_org
    AND expense_type_id = v_expense_type_id
    AND is_active = true
    AND name ILIKE '%peralatan%'
  LIMIT 1;

  IF v_physical_category_id IS NULL THEN
    INSERT INTO public.expense_categories (
      organization_id, expense_type_id, name, description, is_active, is_default
    ) VALUES (
      v_org, v_expense_type_id, 'Peralatan Kantor', 'ATK & perangkat fisik (QA seed v2)', true, false
    )
    RETURNING id INTO v_physical_category_id;
  END IF;

  SELECT id INTO v_debt_id
  FROM public.debts
  WHERE organization_id = v_org
    AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  -- =========================================================================
  -- PENDING — uji Approve / Reject di Request Details
  -- =========================================================================

  -- 1) pending_approval + vendor bank (Pay via Brick nanti)
  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, expected_outcome,
    vendor_name, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Pending — langganan SaaS analytics',
    890000,
    'Langganan bulanan dashboard analytics untuk tim growth.',
    'Keputusan marketing berbasis data.',
    'Laporan funnel mingguan otomatis.',
    'PT SaaS Analytics QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'pending_approval', now() - interval '6 hours', v_requester, 'pending', false
  );

  -- 2) submitted — physical item (uji expense type + category + withdrawal Xendit saat approve)
  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, quantity, description, company_benefit,
    vendor_name,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Physical Item',
    v_marker || ' Submitted — mouse & keyboard QA',
    325000, 2,
    'Mouse + keyboard ergonomis untuk tim QA.',
    'Produktivitas kerja harian.',
    'Toko ATK QA',
    v_expense_type_id, v_physical_category_id,
    'submitted', now() - interval '3 hours', v_requester, 'pending', false
  );

  -- 3) submitted — reimbursement style
  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type,
    request_title, amount_idr, description, company_benefit,
    reimbursement_type, merchant_name, receipt_number, expense_date,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'reimbursement',
    v_marker || ' Submitted — reimbursement transport rapat',
    185000,
    'Grab ke kantor klien untuk demo produk.',
    'Menjaga jadwal meeting dengan klien.',
    'Transport', 'Grab QA', 'GRB-2026-0614', now() - interval '2 days',
    v_expense_type_id, v_service_category_id,
    'submitted', now() - interval '1 hour', v_requester, 'pending', false
  );

  -- 4) pending_approval — recurring
  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit,
    vendor_name, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring, recurring_frequency
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Pending — langganan cloud storage (recurring)',
    450000,
    'Google Workspace / cloud storage bulanan.',
    'Kolaborasi dokumen tim.',
    'PT Cloud Storage QA', 'BCA', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'pending_approval', now() - interval '12 hours', v_requester, 'pending', true, 'monthly'
  );

  -- =========================================================================
  -- APPROVED — tampil di history Approvals + antrian Payment Process
  -- =========================================================================

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, bank_account_id,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Approved — kurir dokumen (bank)',
    150000,
    'Biaya kurir dokumen kontrak.',
    'Kelancaran administrasi.',
    'Kurir QA', 'BRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'approved', now() - interval '4 days', now() - interval '3 days',
    v_approver, v_approver, 'QA Approver',
    'Disetujui — tarik dari rekening bisnis.',
    v_mandiri_bank,
    v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, gateway_wallet_provider,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Approved — vendor kecil (Xendit drawer)',
    275000,
    'Pembayaran vendor jasa desain — uji funding Xendit.',
    'Mendukung materi promosi.',
    'Studio Desain QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'approved', now() - interval '5 days', now() - interval '4 days',
    v_approver, v_approver, 'QA Approver',
    'Disetujui — tarik dari laci Xendit.',
    'xendit',
    v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, gateway_wallet_provider,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Approved — vendor utama (Brick drawer)',
    10000,
    'Invoice vendor utama — uji Pay via Brick + withdrawal Brick drawer.',
    'Operasional bisnis inti.',
    'PT Vendor Utama QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'approved', now() - interval '6 days', now() - interval '5 days',
    v_approver, v_approver, 'QA Approver',
    'Disetujui — tarik dari laci Brick.',
    'brick',
    v_requester, 'pending', false
  );

  IF v_debt_id IS NOT NULL THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, description, company_benefit, vendor_name,
      vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
      expense_type_id, expense_category_id,
      status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
      approval_notes, withdrawal_from_balance,
      created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Service',
      v_marker || ' Approved — langganan software (debt/CC)',
      499000,
      'Langganan software tahunan — uji withdrawal dari hutang/CC.',
      'Efisiensi operasional.',
      'PT Software QA', 'BCA', '12345678', 'PROD ONLY',
      v_expense_type_id, v_service_category_id,
      'approved', now() - interval '7 days', now() - interval '6 days',
      v_approver, v_approver, 'QA Approver',
      'Disetujui — tarik dari limit CC.',
      v_debt_id,
      v_requester, 'pending', false
    );
  END IF;

  -- =========================================================================
  -- REJECTED — history Approvals
  -- =========================================================================

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, vendor_name,
    expense_type_id, expense_category_id,
    status, submitted_at, rejected_at, rejected_by, rejected_by_user_id, rejected_by_name,
    rejection_reason,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Physical Item',
    v_marker || ' Rejected — monitor premium (over budget)',
    4500000,
    'Monitor 32" untuk workstation desain.',
    'Kenyamanan desain visual.',
    'Toko Elektronik QA',
    v_expense_type_id, v_physical_category_id,
    'rejected', now() - interval '8 days', now() - interval '7 days',
    v_approver, v_approver, 'QA Approver',
    'Budget Q2 sudah penuh; ajukan ulang kuartal depan.',
    v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, request_type, purchase_type,
    request_title, amount_idr, description, company_benefit, vendor_name,
    expense_type_id, expense_category_id,
    status, submitted_at, rejected_at, rejected_by, rejected_by_user_id, rejected_by_name,
    rejection_reason,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'purchase', 'Service',
    v_marker || ' Rejected — vendor tanpa kontrak',
    2200000,
    'Jasa konsultasi legal ad-hoc.',
    'Review kontrak vendor.',
    'Konsultan Legal QA',
    v_expense_type_id, v_service_category_id,
    'rejected', now() - interval '10 days', now() - interval '9 days',
    v_approver, v_approver, 'QA Approver',
    'Vendor belum terdaftar; lengkapi due diligence dulu.',
    v_requester, 'pending', false
  );

  RAISE NOTICE 'Approvals seed v2 OK for org %', v_org;
  RAISE NOTICE 'Marker: %', v_marker;
  RAISE NOTICE 'Expense type: %, service cat: %, physical cat: %', v_expense_type_id, v_service_category_id, v_physical_category_id;
END $$;

-- ---------------------------------------------------------------------------
-- Verifikasi: antrian pending (Approvals → tab pending)
-- ---------------------------------------------------------------------------
SELECT
  pr.id,
  pr.request_title,
  pr.requester_name,
  pr.amount_idr,
  pr.request_type,
  pr.purchase_type,
  pr.status,
  pr.is_recurring,
  pr.submitted_at::date AS request_date,
  et.name AS expense_type,
  ec.name AS expense_category,
  pr.gateway_wallet_provider
FROM public.purchase_requests pr
LEFT JOIN public.expense_types et ON et.id = pr.expense_type_id
LEFT JOIN public.expense_categories ec ON ec.id = pr.expense_category_id
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.request_title LIKE '[APPROVALS_SANDBOX_v2]%'
ORDER BY
  CASE pr.status
    WHEN 'pending_approval' THEN 0
    WHEN 'submitted' THEN 1
    WHEN 'approved' THEN 2
    WHEN 'rejected' THEN 3
    ELSE 4
  END,
  pr.created_at DESC;

-- Ringkasan metrics (selaras kartu di halaman Approvals)
SELECT
  count(*) AS total_requests,
  coalesce(sum(amount_idr), 0) AS total_value,
  count(*) FILTER (WHERE status IN ('pending_approval', 'submitted')) AS pending_review,
  coalesce(sum(amount_idr) FILTER (WHERE status IN ('pending_approval', 'submitted')), 0) AS pending_value,
  count(*) FILTER (WHERE status = 'approved') AS approved_count,
  coalesce(sum(amount_idr) FILTER (WHERE status = 'approved'), 0) AS approved_value,
  count(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  count(*) FILTER (WHERE coalesce(is_recurring, false)) AS recurring_count,
  count(*) FILTER (WHERE gateway_wallet_provider = 'xendit') AS xendit_funding,
  count(*) FILTER (WHERE gateway_wallet_provider = 'brick') AS brick_funding
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title LIKE '[APPROVALS_SANDBOX_v2]%';
