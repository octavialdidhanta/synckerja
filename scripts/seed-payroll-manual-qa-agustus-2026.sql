-- Manual QA payroll: Agustus 2026 — tunjangan berbeda per karyawan + denda keterlambatan.
-- Org: PT. Synckerja Office (663c9336-8cb6-4a36-9ad9-313126e70a1a)
-- Idempotent: skips if period "Agustus 2026 (Manual QA)" already exists.
--
-- SQL Editor / postgres: JANGAN panggil process_payroll_run atau calculate_payroll_run_totals
-- (keduanya cek user_organization_ids → "Not authorized" tanpa JWT user).
-- Script ini memakai payroll_calculate_employee + agregasi totals inline.
-- Alternatif: seed hanya periode/run draft, lalu Process Payroll dari UI.

DO $$
DECLARE
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_period uuid;
  v_run uuid;
  v_penalty_rule uuid := '85fa2111-36e6-472b-8054-76247284e38c';
  v_tax uuid := 'f1a1a1a1-1111-4111-8111-111111111111';
  v_epi_octa uuid := 'f3c1c1c1-3333-4333-8333-333333333301';
  v_epi_aidah uuid := 'f3c2c2c2-3333-4333-8333-333333333302';
  v_octa uuid := '001b6725-bf16-4a2f-81ae-8960cf86c46d';
  v_aidah uuid := '485f1a2b-da0c-4464-8c22-ad9ca6e58942';
  v_result jsonb;
BEGIN
  SELECT id INTO v_period
  FROM public.payroll_periods
  WHERE organization_id = v_org
    AND period_name = 'Agustus 2026 (Manual QA)'
  LIMIT 1;

  IF v_period IS NULL THEN
    INSERT INTO public.payroll_periods (
      organization_id,
      period_name,
      period_type,
      start_date,
      end_date,
      pay_date,
      status,
      notes,
      is_bonus_period
    ) VALUES (
      v_org,
      'Agustus 2026 (Manual QA)',
      'monthly',
      '2026-08-01',
      '2026-08-31',
      '2026-08-25',
      'approved',
      'Seed manual QA: tunjangan berbeda + potongan keterlambatan',
      false
    )
    RETURNING id INTO v_period;
  END IF;

  -- Period-only allowances (berbeda per karyawan)
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_payroll_components
    WHERE employee_payroll_info_id = v_epi_octa
      AND payroll_period_id = v_period
      AND component_name = 'Tunjangan Proyek Agustus (QA)'
  ) THEN
    INSERT INTO public.employee_payroll_components (
      employee_payroll_info_id, organization_id, component_name, component_type,
      component_category, amount, is_active, is_percentage, is_recurring, is_taxable,
      payroll_period_id, tax_configuration_id
    ) VALUES (
      v_epi_octa, v_org, 'Tunjangan Proyek Agustus (QA)', 'allowance',
      'project', 750000, true, false, false, true,
      v_period, v_tax
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_payroll_components
    WHERE employee_payroll_info_id = v_epi_aidah
      AND payroll_period_id = v_period
      AND component_name = 'Tunjangan Koordinasi Event (QA)'
  ) THEN
    INSERT INTO public.employee_payroll_components (
      employee_payroll_info_id, organization_id, component_name, component_type,
      component_category, amount, is_active, is_percentage, is_recurring, is_taxable,
      payroll_period_id, tax_configuration_id
    ) VALUES (
      v_epi_aidah, v_org, 'Tunjangan Koordinasi Event (QA)', 'allowance',
      'event', 600000, true, false, false, true,
      v_period, v_tax
    );
  END IF;

  -- Period-only deduction (Aidah saja)
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_payroll_components
    WHERE employee_payroll_info_id = v_epi_aidah
      AND payroll_period_id = v_period
      AND component_name = 'Potongan Kasbon Agustus (QA)'
  ) THEN
    INSERT INTO public.employee_payroll_components (
      employee_payroll_info_id, organization_id, component_name, component_type,
      component_category, amount, is_active, is_percentage, is_recurring, is_taxable,
      payroll_period_id, tax_configuration_id
    ) VALUES (
      v_epi_aidah, v_org, 'Potongan Kasbon Agustus (QA)', 'deduction',
      'loan', 150000, true, false, false, false,
      v_period, v_tax
    );
  END IF;

  -- Denda keterlambatan aktif untuk periode ini
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_penalties
    WHERE organization_id = v_org
      AND payroll_periods_id = v_period
      AND employee_id = v_octa
      AND applied_date = '2026-08-05'
  ) THEN
    INSERT INTO public.attendance_penalties (
      employee_id, organization_id, penalty_rule_id, penalty_amount,
      penalty_reason, applied_date, status, payroll_periods_id, auto_generated
    ) VALUES
      (v_octa, v_org, v_penalty_rule, 50000, 'Keterlambatan masuk — 5 Agt 2026 (QA)', '2026-08-05', 'active', v_period, false),
      (v_octa, v_org, v_penalty_rule, 50000, 'Keterlambatan masuk — 12 Agt 2026 (QA)', '2026-08-12', 'active', v_period, false),
      (v_aidah, v_org, v_penalty_rule, 50000, 'Keterlambatan masuk — 8 Agt 2026 (QA)', '2026-08-08', 'active', v_period, false);
  END IF;

  SELECT id INTO v_run
  FROM public.payroll_runs
  WHERE organization_id = v_org
    AND payroll_period_id = v_period
    AND run_name = 'Manual QA — Agustus 2026'
  LIMIT 1;

  IF v_run IS NULL THEN
    INSERT INTO public.payroll_runs (
      organization_id,
      payroll_period_id,
      tax_configuration_id,
      run_name,
      run_date,
      status,
      calculation_method,
      notes
    ) VALUES (
      v_org,
      v_period,
      v_tax,
      'Manual QA — Agustus 2026',
      CURRENT_DATE,
      'draft',
      'automatic',
      'Run untuk uji manual: tunjangan berbeda + denda telat'
    )
    RETURNING id INTO v_run;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_payroll_calculations
    WHERE payroll_run_id = v_run
  ) THEN
    v_result := public.payroll_calculate_employee(v_run, v_octa);
    v_result := public.payroll_calculate_employee(v_run, v_aidah);

    UPDATE public.payroll_runs
    SET status = 'calculated',
        calculated_at = now(),
        updated_at = now()
    WHERE id = v_run;

    UPDATE public.payroll_runs pr
    SET
      total_employees = sub.cnt,
      total_gross_pay = sub.gross,
      total_net_pay = sub.net,
      total_deductions = sub.deductions,
      total_penalties = sub.penalties,
      total_taxes = sub.taxes,
      updated_at = now()
    FROM (
      SELECT
        COUNT(*)::integer AS cnt,
        COALESCE(SUM(gross_pay), 0) AS gross,
        COALESCE(SUM(take_home_pay), 0) AS net,
        COALESCE(SUM(total_deductions), 0) AS deductions,
        COALESCE(SUM(total_penalties), 0) AS penalties,
        COALESCE(SUM(total_tax_deductions), 0) AS taxes
      FROM public.employee_payroll_calculations
      WHERE payroll_run_id = v_run
    ) sub
    WHERE pr.id = v_run;
  ELSE
    RAISE NOTICE 'Run already has calculations — skip calculate';
  END IF;

  RAISE NOTICE 'period_id=% run_id=%', v_period, v_run;
END $$;

-- Summary
SELECT
  pp.period_name,
  pr.id AS run_id,
  pr.run_name,
  pr.status AS run_status,
  e.full_name,
  epc.take_home_pay,
  epc.total_allowances,
  epc.total_penalties,
  epc.total_deductions,
  epc.payment_status
FROM public.payroll_runs pr
JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
JOIN public.employee_payroll_calculations epc ON epc.payroll_run_id = pr.id
JOIN public.employees e ON e.id = epc.employee_id
WHERE pp.period_name = 'Agustus 2026 (Manual QA)'
  AND pr.run_name = 'Manual QA — Agustus 2026'
ORDER BY e.full_name;
