-- Seed untuk /expenses/approvals + /expenses/payment-process (batch v3).
-- Selaras alur disbursement gateway nyata (Xendit/Brick): vendor bank diisi di approval.
--
-- Org default QA: 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Marker: [APPROVALS_SANDBOX_v3]
-- Jalankan di Supabase SQL Editor (service role / postgres).
--
-- Idempotent: hapus baris marker v3 lalu insert ulang.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_mandiri_bank uuid := '767c9135-fb63-4564-93d3-8672cd278d77';
  v_marker text := '[APPROVALS_SANDBOX_v3]';
  v_requester uuid;
  v_approver uuid;
  v_expense_type_id uuid;
  v_service_category_id uuid;
  v_physical_category_id uuid;
  v_debt_id uuid;
BEGIN
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
    VALUES (v_org, 'Operasional', 'Pengeluaran operasional harian (QA seed v3)', true, true)
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
      v_org, v_expense_type_id, 'Jasa & Vendor', 'Vendor, kurir, konsultan (QA seed v3)', true, true
    )
    RETURNING id INTO v_service_category_id;
  END IF;

  SELECT id INTO v_physical_category_id
  FROM public.expense_categories
  WHERE organization_id = v_org
    AND expense_type_id = v_expense_type_id
    AND is_active = true
    AND (name ILIKE '%peralatan%' OR name ILIKE '%atk%')
  LIMIT 1;

  IF v_physical_category_id IS NULL THEN
    INSERT INTO public.expense_categories (
      organization_id, expense_type_id, name, description, is_active, is_default
    ) VALUES (
      v_org, v_expense_type_id, 'Peralatan Kantor', 'ATK & perangkat fisik (QA seed v3)', true, false
    )
    RETURNING id INTO v_physical_category_id;
  END IF;

  SELECT id INTO v_debt_id
  FROM public.debts
  WHERE organization_id = v_org AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  -- =========================================================================
  -- PENDING — uji Approve / Reject
  -- =========================================================================

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, expected_outcome,
    vendor_name, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Growth',
    'purchase', 'Service',
    v_marker || ' Pending — langganan SaaS analytics',
    890000,
    'Langganan bulanan dashboard analytics untuk tim growth.',
    'Keputusan marketing berbasis data.',
    'Laporan funnel mingguan otomatis.',
    'PT SaaS Analytics QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'pending_approval', now() - interval '6 hours', v_requester, 'pending', false
  );

  -- Mouse & keyboard: vendor bank sudah diisi (siap disbursement Xendit di Payment Process)
  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, quantity,
    description, company_benefit,
    vendor_name, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'QA',
    'purchase', 'Physical Item',
    v_marker || ' Submitted — mouse & keyboard QA',
    325000, 2,
    'Mouse + keyboard ergonomis untuk tim QA.',
    'Produktivitas kerja harian.',
    'Toko ATK QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_physical_category_id,
    'submitted', now() - interval '3 hours', v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, request_title, amount_idr, description, company_benefit,
    reimbursement_type, merchant_name, receipt_number, expense_date,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Sales',
    'reimbursement',
    v_marker || ' Submitted — reimbursement transport rapat',
    185000,
    'Grab ke kantor klien untuk demo produk.',
    'Menjaga jadwal meeting dengan klien.',
    'Transport', 'Grab QA', 'GRB-2026-0614', (CURRENT_DATE - 2),
    v_expense_type_id, v_service_category_id,
    'submitted', now() - interval '1 hour', v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit,
    vendor_name, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, created_by, payment_status, is_recurring, recurring_frequency
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Engineering',
    'purchase', 'Service',
    v_marker || ' Pending — langganan cloud storage (recurring)',
    450000,
    'Google Workspace / cloud storage bulanan.',
    'Kolaborasi dokumen tim.',
    'PT Cloud Storage QA', 'BCA', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'pending_approval', now() - interval '12 hours', v_requester, 'pending', true, 'monthly'
  );

  -- =========================================================================
  -- APPROVED — antrian Payment Process (uji tiap sumber dana)
  -- =========================================================================

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, bank_account_id,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Finance',
    'purchase', 'Service',
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
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, gateway_wallet_provider,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Marketing',
    'purchase', 'Service',
    v_marker || ' Approved — vendor kecil (Xendit drawer)',
    275000,
    'Pembayaran vendor jasa desain — uji disbursement Xendit nyata.',
    'Mendukung materi promosi.',
    'Studio Desain QA', 'MANDIRI', '12345678', 'PROD ONLY',
    v_expense_type_id, v_service_category_id,
    'approved', now() - interval '5 days', now() - interval '4 days',
    v_approver, v_approver, 'QA Approver',
    'Disetujui — tarik dari laci Xendit (disbursement API).',
    'xendit',
    v_requester, 'pending', false
  );

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
    vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
    expense_type_id, expense_category_id,
    status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
    approval_notes, gateway_wallet_provider,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Operations',
    'purchase', 'Service',
    v_marker || ' Approved — vendor utama (Brick drawer)',
    10000,
    'Invoice vendor utama — uji disbursement Brick (sandbox ≤ Rp 100.000).',
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
      organization_id, requester_id, requester_name, department_name,
      request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
      vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
      expense_type_id, expense_category_id,
      status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
      approval_notes, withdrawal_from_balance,
      created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'IT',
      'purchase', 'Service',
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
  -- REJECTED — history
  -- =========================================================================

  INSERT INTO public.purchase_requests (
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
    expense_type_id, expense_category_id,
    status, submitted_at, rejected_at, rejected_by, rejected_by_user_id, rejected_by_name,
    rejection_reason,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Design',
    'purchase', 'Physical Item',
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
    organization_id, requester_id, requester_name, department_name,
    request_type, purchase_type, request_title, amount_idr, description, company_benefit, vendor_name,
    expense_type_id, expense_category_id,
    status, submitted_at, rejected_at, rejected_by, rejected_by_user_id, rejected_by_name,
    rejection_reason,
    created_by, payment_status, is_recurring
  ) VALUES (
    v_org, v_requester, 'QA Requester', 'Legal',
    'purchase', 'Service',
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

  RAISE NOTICE 'Approvals seed v3 OK for org %', v_org;
END $$;

-- Verifikasi
SELECT
  pr.request_title,
  pr.department_name,
  pr.amount_idr,
  pr.status,
  pr.payment_status,
  pr.gateway_wallet_provider,
  pr.vendor_bank_code
FROM public.purchase_requests pr
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.request_title LIKE '[APPROVALS_SANDBOX_v3]%'
ORDER BY pr.created_at DESC;

SELECT
  count(*) AS total,
  count(*) FILTER (WHERE status IN ('pending_approval', 'submitted')) AS pending_review,
  count(*) FILTER (WHERE status = 'approved') AS approved,
  count(*) FILTER (WHERE status = 'rejected') AS rejected
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title LIKE '[APPROVALS_SANDBOX_v3]%';
