// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient Deno types for the editor
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { secretMatches } from "../_shared/aiEmployee/planDraft.mjs";
import { buildWorkReportEmail, reportFromHeader } from "../_shared/aiEmployee/workReportEmail.mjs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-synckerja-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sendResend(args: { to: string; senderName: string; subject: string; html: string; text: string }) {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
  if (!resendKey || !fromEmail) return { ok: false as const, error: "email_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: reportFromHeader(fromEmail, args.senderName),
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    return { ok: false as const, error: detail || "email_failed" };
  }
  return { ok: true as const };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const internalSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !internalSecret) return json({ error: "misconfigured" }, 500);
  if (!secretMatches(req.headers.get("x-synckerja-internal-secret") ?? "", internalSecret)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const routineId = typeof body.routine_id === "string" ? body.routine_id.trim() : "";
  if (!isUuid(routineId)) return json({ error: "invalid_input" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const prepared = await admin.rpc("ai_employee_routine_prepare", { p_routine_id: routineId });
  if (prepared.error || !prepared.data || typeof prepared.data !== "object") {
    return json({ error: "prepare_failed" }, 502);
  }
  const row = prepared.data as Record<string, unknown>;
  const periodStart = typeof row.period_start === "string" ? row.period_start : "";
  const periodEnd = typeof row.period_end === "string" ? row.period_end : "";
  const summary = row.summary && typeof row.summary === "object" ? row.summary : {};
  const skipReason = typeof row.skip_reason === "string" ? row.skip_reason : "";
  const recipient = typeof row.recipient_email === "string" ? row.recipient_email : "";
  const employeeName = typeof row.employee_name === "string" ? row.employee_name : "";
  const senderName = typeof row.sender_name === "string" && row.sender_name.trim()
    ? row.sender_name.trim()
    : employeeName;
  const actionCode = typeof row.action_code === "string" ? row.action_code : "";
  const primary = recipient.trim().toLowerCase();
  const copies = Array.isArray(row.copy_emails)
    ? row.copy_emails.flatMap((item) => {
      if (typeof item !== "string") return [];
      const email = item.trim().toLowerCase();
      return email.includes("@") && email !== primary ? [email] : [];
    }).filter((email, index, list) => list.indexOf(email) === index)
    : [];

  const finish = (status: "sent" | "failed" | "skipped", error: string, email: string) => admin.rpc("ai_employee_routine_finish", {
    p_routine_id: routineId,
    p_status: status,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_recipient_email: email,
    p_summary: summary,
    p_error: error,
  });

  if (!periodStart || !periodEnd) return json({ error: "prepare_failed" }, 502);
  if (skipReason) {
    const closed = await finish("skipped", skipReason, "");
    if (closed.error) return json({ error: "finish_failed" }, 502);
    return json({ ok: true, status: "skipped" });
  }

  const message = buildWorkReportEmail({
    employeeName,
    senderName,
    actionCode,
    periodStart,
    periodEnd,
    summary: summary as Record<string, unknown>,
  });
  const sent = await sendResend({
    to: recipient,
    senderName,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (!sent.ok) {
    const closed = await finish("failed", sent.error, recipient);
    if (closed.error) return json({ error: "finish_failed" }, 502);
    return json({ ok: false, status: "failed" }, 502);
  }

  const extraErrors: string[] = [];
  for (const [index, email] of copies.entries()) {
    const extra = await sendResend({
      to: email,
      senderName,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (!extra.ok) extraErrors.push(`Email tambahan ${index + 1} gagal`);
  }
  const closed = await finish("sent", extraErrors.join("; ").slice(0, 500), recipient);
  if (closed.error) return json({ error: "finish_failed" }, 502);
  return json({ ok: true, status: "sent" });
});
