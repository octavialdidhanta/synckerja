/**
 * Dispatch instant inventory alert email for one queued job.
 *
 * Deploy: `supabase functions deploy dispatch-operational-inventory-alert --no-verify-jwt`
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SECRET), RESEND_API_KEY, RESEND_FROM_EMAIL
 */
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAuthorizedServiceCaller,
  resolveSupabaseAdminKey,
} from "../_shared/serviceRoleEdgeAuth.ts";
import { collectOperationalEmailRecipients } from "../_shared/operationalEmailRecipients.ts";
import {
  buildInventoryInstantEmailHtml,
  type InventoryAlertIngredientRow,
} from "../_shared/inventoryAlertEmailHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { jobId?: string };

const MAX_ATTEMPTS = 2;

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendResend(args: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
  if (!resendKey || !fromEmail) {
    return { ok: false, error: "Missing RESEND_API_KEY or RESEND_FROM_EMAIL" };
  }
  if (args.to.length === 0) return { ok: false, error: "no_recipients" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || "Resend request failed" };
  }
  return { ok: true };
}

function parseItems(payload: unknown): InventoryAlertIngredientRow[] {
  const root = (payload ?? {}) as { items?: unknown[] };
  const raw = Array.isArray(root.items) ? root.items : [];
  const out: InventoryAlertIngredientRow[] = [];
  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const status = r.status === "out" || r.status === "low" ? r.status : null;
    if (!status) continue;
    const inStock = Number(r.inStock);
    const alertAtRaw = r.alertAt == null ? null : Number(r.alertAt);
    out.push({
      outletName: String(r.outletName ?? "Outlet"),
      name: String(r.name ?? "Ingredient"),
      status,
      inStock: Number.isFinite(inStock) ? inStock : 0,
      alertAt:
        alertAtRaw != null && Number.isFinite(alertAtRaw) ? alertAtRaw : null,
      unit: String(r.unit ?? ""),
    });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = resolveSupabaseAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  if (!isAuthorizedServiceCaller(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let jobId = "";
  try {
    const body = (await req.json()) as Body;
    jobId = String(body.jobId ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!jobId) {
    return json({ error: "jobId required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: jobErr } = await admin
    .from("operational_inventory_alert_jobs")
    .select("id, organization_id, payload, status, attempts")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) {
    console.error(jobErr);
    return json({ error: jobErr.message }, 500);
  }
  if (!job) {
    return json({ error: "job_not_found" }, 404);
  }
  if (job.status === "sent") {
    return json({ ok: true, skipped: true, reason: "already_sent" });
  }

  const attempts = Number(job.attempts ?? 0) + 1;
  await admin
    .from("operational_inventory_alert_jobs")
    .update({ attempts })
    .eq("id", jobId);

  const orgId = String(job.organization_id ?? "");
  const items = parseItems(job.payload);
  if (items.length === 0) {
    await admin
      .from("operational_inventory_alert_jobs")
      .update({ status: "failed", last_error: "empty_payload" })
      .eq("id", jobId);
    return json({ ok: false, error: "empty_payload" }, 400);
  }

  try {
    const emails = await collectOperationalEmailRecipients(admin, orgId);
    if (emails.size === 0) {
      await admin
        .from("operational_inventory_alert_jobs")
        .update({ status: "failed", last_error: "no_recipients" })
        .eq("id", jobId);
      return json({ ok: false, error: "no_recipients" }, 400);
    }

    const { data: org } = await admin
      .from("organizations")
      .select("company_name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName = String(
      (org as { company_name?: string } | null)?.company_name ?? "Organization",
    );

    const html = buildInventoryInstantEmailHtml({ orgName, items });
    const subject = `[${orgName}] Inventory alert — ${items.length} item(s)`;

    const result = await sendResend({
      to: [...emails],
      subject,
      html,
    });

    if (!result.ok) {
      const terminal = attempts >= MAX_ATTEMPTS;
      await admin
        .from("operational_inventory_alert_jobs")
        .update({
          status: terminal ? "failed" : "pending",
          last_error: result.error ?? "send_failed",
        })
        .eq("id", jobId);
      return json({ ok: false, error: result.error, attempts }, 502);
    }

    await admin
      .from("operational_inventory_alert_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", jobId);

    return json({ ok: true, jobId, recipients: emails.size, items: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const terminal = attempts >= MAX_ATTEMPTS;
    await admin
      .from("operational_inventory_alert_jobs")
      .update({
        status: terminal ? "failed" : "pending",
        last_error: msg,
      })
      .eq("id", jobId);
    console.error("dispatch inventory alert failed", jobId, e);
    return json({ ok: false, error: msg }, 500);
  }
});
