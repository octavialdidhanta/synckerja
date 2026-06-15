-- Seed / backfill purchase_requests untuk /expenses/approvals (+ payment process).
-- Termasuk expense_type_id & expense_category_id agar Pay manually tidak error.
--
-- Batch terbaru (fresh pending + gateway): scripts/expenses-approvals-sandbox-seed-v2.sql
-- Marker v2: [APPROVALS_SANDBOX_v2] — marker lama: [PAYMENT_SANDBOX]
-- Org default QA: 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Jalankan di Supabase SQL Editor (service role / postgres).

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_mandiri_bank uuid := '767c9135-fb63-4564-93d3-8672cd278d77';
  v_marker text := '[PAYMENT_SANDBOX]';
  v_requester uuid;
  v_approver uuid;
  v_expense_type_id uuid;
  v_expense_category_id uuid;
  v_physical_category_id uuid;
BEGIN
  -- Requester (any member)
  SELECT ur.user_id INTO v_requester
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  -- Approver (owner/admin)
  SELECT ur.user_id INTO v_approver
  FROM public.user_roles ur
  WHERE ur.organization_id = v_org
    AND ur.role IN ('owner', 'admin')
  ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END, ur.created_at NULLS LAST
  LIMIT 1;

  IF v_requester IS NULL OR v_approver IS NULL THEN
    RAISE EXCEPTION 'No user_roles found for org %. Set v_org to your active organization.', v_org;
  END IF;

  -- Expense type + categories (create QA defaults if org has none)
  SELECT id INTO v_expense_type_id
  FROM public.expense_types
  WHERE organization_id = v_org AND is_active = true
  ORDER BY is_default DESC, created_at
  LIMIT 1;

  IF v_expense_type_id IS NULL THEN
    INSERT INTO public.expense_types (organization_id, name, description, is_active, is_default)
    VALUES (v_org, 'Operasional', 'Pengeluaran operasional harian (QA seed)', true, true)
    RETURNING id INTO v_expense_type_id;
  END IF;

  SELECT id INTO v_expense_category_id
  FROM public.expense_categories
  WHERE organization_id = v_org
    AND expense_type_id = v_expense_type_id
    AND is_active = true
  ORDER BY is_default DESC, created_at
  LIMIT 1;

  IF v_expense_category_id IS NULL THEN
    INSERT INTO public.expense_categories (
      organization_id, expense_type_id, name, description, is_active, is_default
    ) VALUES (
      v_org, v_expense_type_id, 'Jasa & Vendor', 'Vendor, kurir, konsultan (QA seed)', true, true
    )
    RETURNING id INTO v_expense_category_id;
  END IF;

  SELECT id INTO v_physical_category_id
  FROM public.expense_categories
  WHERE organization_id = v_org
    AND is_active = true
    AND name ILIKE '%aset%'
  LIMIT 1;

  IF v_physical_category_id IS NULL THEN
    INSERT INTO public.expense_categories (
      organization_id, expense_type_id, name, description, is_active, is_default
    ) VALUES (
      v_org, v_expense_type_id, 'Peralatan Kantor', 'ATK & perangkat fisik (QA seed)', true, false
    )
    RETURNING id INTO v_physical_category_id;
  END IF;

  -- Backfill type/category on existing sandbox rows
  UPDATE public.purchase_requests pr
  SET
    expense_type_id = COALESCE(pr.expense_type_id, v_expense_type_id),
    expense_category_id = COALESCE(
      pr.expense_category_id,
      CASE WHEN pr.purchase_type = 'Physical Item' THEN v_physical_category_id ELSE v_expense_category_id END
    ),
    updated_at = now()
  WHERE pr.organization_id = v_org
    AND pr.request_title LIKE v_marker || '%'
    AND (pr.expense_type_id IS NULL OR pr.expense_category_id IS NULL);

  -- -------------------------------------------------------------------------
  -- Approval queue (Pending) — 1 baris untuk uji approve dari UI
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Pending approval — vendor hosting'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, description, company_benefit, vendor_name,
      expense_type_id, expense_category_id,
      status, submitted_at, created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Service',
      v_marker || ' Pending approval — vendor hosting',
      750000,
      'Langganan hosting tahunan untuk staging.',
      'Menjaga uptime environment demo.',
      'PT Vendor Hosting QA',
      v_expense_type_id, v_expense_category_id,
      'pending_approval', now(), v_requester, 'pending', false
    );
  END IF;

  -- Submitted (belum di-approve) — opsional second queue item
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org
      AND request_title = v_marker || ' Submitted — alat kantor'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, quantity, description, company_benefit, vendor_name,
      expense_type_id, expense_category_id,
      status, submitted_at, created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Physical Item',
      v_marker || ' Submitted — alat kantor',
      325000, 2,
      'Mouse + keyboard untuk tim QA.',
      'Produktivitas kerja harian.',
      'Toko ATK QA',
      v_expense_type_id, v_physical_category_id,
      'submitted', now(), v_requester, 'pending', false
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Approved — tampil di Approvals (history) + Payment process
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org AND request_title = v_marker || ' Approved — vendor kecil'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, description, company_benefit, vendor_name,
      vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
      expense_type_id, expense_category_id,
      status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
      bank_account_id, created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Service',
      v_marker || ' Approved — vendor kecil',
      150000,
      'Biaya kurir dokumen.',
      'Kelancaran administrasi.',
      'Kurir QA', 'BRI', '12345678', 'PROD ONLY',
      v_expense_type_id, v_expense_category_id,
      'approved', now() - interval '2 days', now() - interval '1 day',
      v_approver, v_approver, 'QA Approver',
      v_mandiri_bank, v_requester, 'pending', false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org AND request_title = v_marker || ' Approved — vendor utama (Brick)'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, description, company_benefit, vendor_name,
      vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
      expense_type_id, expense_category_id,
      status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
      bank_account_id, created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Service',
      v_marker || ' Approved — vendor utama (Brick)',
      10000,
      'Invoice vendor utama — uji Pay via Brick.',
      'Operasional bisnis inti.',
      'PT Vendor Utama QA', 'MANDIRI', '12345678', 'PROD ONLY',
      v_expense_type_id, v_expense_category_id,
      'approved', now() - interval '3 days', now() - interval '2 days',
      v_approver, v_approver, 'QA Approver',
      v_mandiri_bank, v_requester, 'pending', false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE organization_id = v_org AND request_title = v_marker || ' Approved — vendor BCA'
  ) THEN
    INSERT INTO public.purchase_requests (
      organization_id, requester_id, requester_name, request_type, purchase_type,
      request_title, amount_idr, description, company_benefit, vendor_name,
      vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder,
      expense_type_id, expense_category_id,
      status, submitted_at, approved_at, approved_by, approved_by_user_id, approved_by_name,
      bank_account_id, created_by, payment_status, is_recurring
    ) VALUES (
      v_org, v_requester, 'QA Requester', 'purchase', 'Service',
      v_marker || ' Approved — vendor BCA',
      3187500,
      'Jasa konsultan bulanan.',
      'Dukungan keputusan operasional.',
      'Konsultan QA', 'BCA', '12345678', 'PROD ONLY',
      v_expense_type_id, v_expense_category_id,
      'approved', now() - interval '5 days', now() - interval '4 days',
      v_approver, v_approver, 'QA Approver',
      v_mandiri_bank, v_requester, 'pending', false
    );
  END IF;

  RAISE NOTICE 'Approvals seed OK for org %', v_org;
  RAISE NOTICE 'Expense type: %, category: %', v_expense_type_id, v_expense_category_id;
END $$;

-- ---------------------------------------------------------------------------
-- Verifikasi: /expenses/approvals (semua request sandbox)
-- ---------------------------------------------------------------------------
SELECT
  pr.id,
  pr.request_title,
  pr.requester_name,
  pr.amount_idr,
  pr.purchase_type,
  pr.status,
  pr.is_recurring,
  pr.submitted_at::date AS request_date,
  pr.approved_at::date AS approved_date,
  pr.approved_by_name,
  et.name AS expense_type,
  ec.name AS expense_category
FROM public.purchase_requests pr
LEFT JOIN public.expense_types et ON et.id = pr.expense_type_id
LEFT JOIN public.expense_categories ec ON ec.id = pr.expense_category_id
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.request_title LIKE '[PAYMENT_SANDBOX]%'
ORDER BY pr.created_at DESC;

-- Ringkasan metrics (selaras kartu di halaman Approvals)
SELECT
  count(*) AS total_requests,
  coalesce(sum(amount_idr), 0) AS total_value,
  count(*) FILTER (WHERE status IN ('pending_approval', 'submitted')) AS pending_review,
  coalesce(sum(amount_idr) FILTER (WHERE status IN ('pending_approval', 'submitted')), 0) AS pending_value,
  count(*) FILTER (WHERE status = 'approved') AS approved_count,
  coalesce(sum(amount_idr) FILTER (WHERE status = 'approved'), 0) AS approved_value,
  count(*) FILTER (WHERE coalesce(is_recurring, false)) AS recurring_count
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title LIKE '[PAYMENT_SANDBOX]%';
