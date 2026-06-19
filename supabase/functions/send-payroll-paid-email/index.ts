/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolvePayrollPayslipUrl } from "../_shared/payroll/payrollEmailConstants.ts";
import { sendPayrollPaidEmail } from "../_shared/payroll/sendPayrollPaidEmail.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  email?: string;
  fullName?: string;
  organizationName?: string;
  periodLabel?: string;
  takeHomePay?: number;
  bankName?: string;
  accountLast4?: string;
  payslipUrl?: string;
  locale?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() ?? "";
    const organizationName = body.organizationName?.trim() ?? "";
    const periodLabel = body.periodLabel?.trim() ?? "Payroll";
    const takeHomePay = Number(body.takeHomePay ?? 0);
    const bankName = body.bankName?.trim() || "Bank";
    const accountLast4 = body.accountLast4?.trim() || "----";
    const payslipUrl = body.payslipUrl?.trim() || resolvePayrollPayslipUrl();
    const locale = body.locale?.toLowerCase().startsWith("en") ? "en" : "id";

    if (!email || !email.includes("@")) {
      return json({ success: false, error: "Valid email is required" }, 400);
    }

    const result = await sendPayrollPaidEmail({
      email,
      fullName,
      organizationName,
      periodLabel,
      takeHomePay,
      bankName,
      accountLast4,
      payslipUrl,
      locale,
    });

    if (!result.ok) {
      return json({ success: false, error: result.error ?? "Send failed" }, 502);
    }

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
