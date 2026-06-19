import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePayrollPayslipUrl } from "./payrollEmailConstants.ts";
import { pickRandomFinanceTipKey } from "./payrollFinanceTipKeys.ts";
import { sendPayrollPaidEmail } from "./sendPayrollPaidEmail.ts";

type CalcNotifyRow = {
  id: string;
  organization_id: string;
  payroll_run_id: string;
  take_home_pay: number;
  payout_snapshot: Record<string, string> | null;
  employee: {
    id: string;
    user_id: string | null;
    full_name: string;
    email: string | null;
  } | null;
  payroll_run: {
    run_name: string | null;
    payroll_periods: { period_name: string } | null;
  } | null;
};

function accountLast4(accountNumber: string | null | undefined): string {
  const digits = String(accountNumber ?? "").replace(/\D/g, "");
  if (digits.length < 4) return digits || "----";
  return digits.slice(-4);
}

function resolvePeriodLabel(row: CalcNotifyRow): string {
  const periodName = row.payroll_run?.payroll_periods?.period_name?.trim();
  if (periodName) return periodName;
  const runName = row.payroll_run?.run_name?.trim();
  if (runName) return runName;
  return "Payroll";
}

function resolveLocale(profileLocale: string | null | undefined): "id" | "en" {
  const raw = String(profileLocale ?? "").toLowerCase();
  if (raw.startsWith("en")) return "en";
  return "id";
}

async function resolveOrganizationName(
  admin: SupabaseClient,
  organizationId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(organizationId);
  if (cached !== undefined) return cached;

  const { data: org } = await admin
    .from("organizations")
    .select("company_name")
    .eq("id", organizationId)
    .maybeSingle();

  const name = org?.company_name?.trim() ?? "";
  cache.set(organizationId, name);
  return name;
}

async function hasPayslipNotified(
  admin: SupabaseClient,
  calculationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("payroll_audit_log")
    .select("id")
    .eq("employee_calculation_id", calculationId)
    .eq("action", "payslip_notified")
    .maybeSingle();
  return Boolean(data?.id);
}

async function logPayslipNotified(
  admin: SupabaseClient,
  row: CalcNotifyRow,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("payroll_audit_log").insert({
    organization_id: row.organization_id,
    payroll_run_id: row.payroll_run_id,
    employee_calculation_id: row.id,
    action: "payslip_notified",
    actor_user_id: null,
    metadata,
  });
  if (error) console.error("log payslip_notified:", error.message);
}

export type NotifyPayrollCalcPaidResult = {
  skipped: boolean;
  emailSent: boolean;
  announcementId: string | null;
  reason?: string;
};

export async function notifyPayrollCalcPaid(
  admin: SupabaseClient,
  calculationId: string,
  organizationNameCache: Map<string, string> = new Map(),
): Promise<NotifyPayrollCalcPaidResult> {
  if (await hasPayslipNotified(admin, calculationId)) {
    return { skipped: true, emailSent: false, announcementId: null, reason: "already_notified" };
  }

  const { data: calc, error: calcErr } = await admin
    .from("employee_payroll_calculations")
    .select(`
      id,
      organization_id,
      payroll_run_id,
      take_home_pay,
      payment_status,
      payout_snapshot,
      employee:employees(id, user_id, full_name, email),
      payroll_run:payroll_runs(
        run_name,
        payroll_periods(period_name)
      )
    `)
    .eq("id", calculationId)
    .maybeSingle();

  if (calcErr || !calc) {
    return {
      skipped: true,
      emailSent: false,
      announcementId: null,
      reason: calcErr?.message ?? "calc_not_found",
    };
  }

  const row = calc as unknown as CalcNotifyRow;

  if (row.payment_status !== "paid") {
    return { skipped: true, emailSent: false, announcementId: null, reason: "not_paid" };
  }

  const snapshot = row.payout_snapshot ?? {};
  const bankName = String(snapshot.bank_name ?? "").trim() || "Bank";
  const last4 = accountLast4(snapshot.account_number);
  const periodLabel = resolvePeriodLabel(row);
  const financeTipKey = pickRandomFinanceTipKey();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let announcementId: string | null = null;
  const employee = row.employee;

  if (employee?.user_id) {
    const { data: inserted, error: annErr } = await admin
      .from("employee_payroll_paid_announcements")
      .insert({
        organization_id: row.organization_id,
        employee_id: employee.id,
        user_id: employee.user_id,
        calculation_id: row.id,
        payroll_run_id: row.payroll_run_id,
        period_label: periodLabel,
        bank_name: bankName,
        account_last4: last4,
        finance_tip_key: financeTipKey,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();

    if (annErr) {
      if (annErr.code === "23505") {
        return { skipped: true, emailSent: false, announcementId: null, reason: "duplicate_announcement" };
      }
      console.error("insert announcement:", annErr.message);
    } else {
      announcementId = inserted?.id ?? null;
    }
  }

  let emailSent = false;
  let emailAddress: string | null = null;

  if (employee?.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, preferred_locale")
      .eq("user_id", employee.user_id)
      .maybeSingle();

    emailAddress = String(employee.email ?? profile?.email ?? "").trim().toLowerCase() || null;

    if (emailAddress && emailAddress.includes("@")) {
      const organizationName = await resolveOrganizationName(
        admin,
        row.organization_id,
        organizationNameCache,
      );
      const payslipUrl = resolvePayrollPayslipUrl();
      const locale = resolveLocale(profile?.preferred_locale as string | null);

      const emailResult = await sendPayrollPaidEmail({
        email: emailAddress,
        fullName: String(profile?.full_name ?? employee.full_name ?? "").trim(),
        organizationName,
        periodLabel,
        takeHomePay: Number(row.take_home_pay ?? 0),
        bankName,
        accountLast4: last4,
        payslipUrl,
        locale,
      });
      emailSent = emailResult.ok;
      if (!emailResult.ok) {
        console.error("sendPayrollPaidEmail:", emailResult.error);
      }
    }
  }

  await logPayslipNotified(admin, row, {
    email_sent: emailSent,
    email: emailAddress,
    announcement_id: announcementId,
    period_label: periodLabel,
  });

  return { skipped: false, emailSent, announcementId };
}

export async function notifyPayrollRunPaidBatch(
  admin: SupabaseClient,
  runId: string,
): Promise<{ processed: number; skipped: number }> {
  const { data: calcs, error } = await admin
    .from("employee_payroll_calculations")
    .select("id")
    .eq("payroll_run_id", runId)
    .eq("payment_status", "paid");

  if (error) {
    console.error("notifyPayrollRunPaidBatch:", error.message);
    return { processed: 0, skipped: 0 };
  }

  let processed = 0;
  let skipped = 0;
  const organizationNameCache = new Map<string, string>();

  for (const calc of calcs ?? []) {
    const result = await notifyPayrollCalcPaid(
      admin,
      String(calc.id),
      organizationNameCache,
    );
    if (result.skipped && result.reason === "already_notified") {
      skipped += 1;
    } else if (!result.skipped) {
      processed += 1;
    } else {
      skipped += 1;
    }
  }

  return { processed, skipped };
}
