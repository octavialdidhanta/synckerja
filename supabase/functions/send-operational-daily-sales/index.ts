/**
 * Daily sales summary email for orgs with daily_sales_summary_enabled
 * and/or daily_gross_profit_enabled.
 * Invoked by pg_cron at 00:15 WIB (yesterday's metrics).
 *
 * Auth: service role / secret key (Authorization Bearer or apikey header)
 */
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAuthorizedServiceCaller,
  resolveSupabaseAdminKey,
} from "../_shared/serviceRoleEdgeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SummaryRow = {
  gross_sales?: number;
  discounts?: number;
  refunds?: number;
  net_sales?: number;
  gratuity?: number;
  tax?: number;
  rounding?: number;
  total_collected?: number;
  transaction_count?: number;
};

type GrossProfitRow = {
  net_sales?: number;
  product_net_sales?: number;
  non_product_net?: number;
  cogs?: number;
  cogs_adjustment?: number;
  cogs_reversed?: number;
  gross_profit?: number;
  gross_profit_margin?: number;
};

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Yesterday [start, end) in Asia/Jakarta as timestamptz ISO strings. */
function yesterdayWibRange(now = new Date()): { fromIso: string; toIso: string; label: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayYmd = fmt.format(now);
  const [y, m, d] = todayYmd.split("-").map(Number);
  const todayUtcMs = Date.UTC(y, m - 1, d) - 7 * 60 * 60 * 1000;
  const yesterdayStartMs = todayUtcMs - 24 * 60 * 60 * 1000;
  const from = new Date(yesterdayStartMs);
  const to = new Date(todayUtcMs);
  const labelFmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    label: labelFmt.format(from),
  };
}

function formatRp(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(abs)
    .replace(/^Rp\s?/, "Rp. ");
}

function metricsTable(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
}

function buildHtml(args: {
  orgName: string;
  dateLabel: string;
  includeSales: boolean;
  includeGrossProfit: boolean;
  metrics: SummaryRow;
  gp: GrossProfitRow;
}): string {
  const sections: string[] = [];

  if (args.includeSales) {
    const m = args.metrics;
    const rows: Array<[string, string]> = [
      ["Gross Sales", formatRp(Number(m.gross_sales ?? 0))],
      ["Discounts", formatRp(Number(m.discounts ?? 0))],
      ["Refunds", formatRp(Number(m.refunds ?? 0))],
      ["Net Sales", formatRp(Number(m.net_sales ?? 0))],
      ["Gratuity", formatRp(Number(m.gratuity ?? 0))],
      ["Tax", formatRp(Number(m.tax ?? 0))],
      ["Total Collected", formatRp(Number(m.total_collected ?? 0))],
      ["Transactions", String(Math.round(Number(m.transaction_count ?? 0)))],
    ];
    sections.push(`
      <h2 style="font-size:16px;margin:0 0 8px;">Daily Sales Summary</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 20px;">
        ${metricsTable(rows)}
      </table>
    `);
  }

  if (args.includeGrossProfit) {
    const g = args.gp;
    const rows: Array<[string, string]> = [
      ["Net Sales", formatRp(Number(g.net_sales ?? 0))],
    ];
    const nonProduct = Number(g.non_product_net ?? 0);
    if (nonProduct > 0.01) {
      rows.push(
        ["Product Net Sales", formatRp(Number(g.product_net_sales ?? 0))],
        ["Non-product / custom", formatRp(nonProduct)],
      );
    }
    rows.push(
      ["COGS", formatRp(Number(g.cogs ?? 0))],
    );
    const cogsAdj = Number(g.cogs_adjustment ?? 0);
    if (Math.abs(cogsAdj) > 0.01) {
      rows.push(["COGS Adjustment", formatRp(cogsAdj)]);
    }
    const cogsRev = Number(g.cogs_reversed ?? 0);
    if (Math.abs(cogsRev) > 0.01) {
      rows.push(["COGS reversed on refund", formatRp(cogsRev)]);
    }
    rows.push(
      ["Gross Profit", formatRp(Number(g.gross_profit ?? 0))],
      ["Gross Profit %", `${Number(g.gross_profit_margin ?? 0)}%`],
    );
    const nonProductNote =
      nonProduct > 0.01
        ? `<p style="margin:0 0 12px;color:#64748b;font-size:12px;">Product lines in Profit by item; non-product revenue (custom/service) is shown separately above.</p>`
        : "";
    sections.push(`
      <h2 style="font-size:16px;margin:0 0 8px;">Gross Profit</h2>
      ${nonProductNote}
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 20px;">
        ${metricsTable(rows)}
      </table>
    `);
  }

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h1 style="font-size:20px;margin:0 0 8px;">Daily Operations Report</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
        ${escapeHtml(args.orgName)} · ${escapeHtml(args.dateLabel)} (WIB) · All outlets
      </p>
      ${sections.join("")}
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
        Ringkasan operasional harian / Daily operations summary from Synckerja Operations.
      </p>
    </div>
  `;
}

async function sendResend(args: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY is not configured" };
  if (args.to.length === 0) return { ok: true };

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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const range = yesterdayWibRange();

  const { data: settingsRows, error: settingsErr } = await admin
    .from("operational_email_notification_settings")
    .select("organization_id, daily_sales_summary_enabled, daily_gross_profit_enabled")
    .or("daily_sales_summary_enabled.eq.true,daily_gross_profit_enabled.eq.true");

  if (settingsErr) {
    console.error(settingsErr);
    return json({ error: settingsErr.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const setting of settingsRows ?? []) {
    const orgId = String(setting.organization_id ?? "");
    if (!orgId) continue;
    const includeSales = Boolean(
      (setting as { daily_sales_summary_enabled?: boolean }).daily_sales_summary_enabled,
    );
    const includeGrossProfit = Boolean(
      (setting as { daily_gross_profit_enabled?: boolean }).daily_gross_profit_enabled,
    );
    if (!includeSales && !includeGrossProfit) continue;

    try {
      const [{ data: org }, { data: recipients }, { data: roles }] = await Promise.all([
        admin.from("organizations").select("id, company_name").eq("id", orgId).maybeSingle(),
        admin
          .from("operational_email_recipients")
          .select("email, status")
          .eq("organization_id", orgId)
          .eq("status", "verified"),
        admin
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", orgId)
          .in("role", ["owner", "admin", "Owner", "Admin"]),
      ]);

      const orgName = String(
        (org as { company_name?: string } | null)?.company_name ?? "Organization",
      );
      const emails = new Set<string>();

      for (const r of recipients ?? []) {
        const email = String((r as { email?: string }).email ?? "")
          .trim()
          .toLowerCase();
        if (email) emails.add(email);
      }

      const ownerAdminIds = (roles ?? [])
        .map((r) => String((r as { user_id?: string }).user_id ?? ""))
        .filter(Boolean);
      if (ownerAdminIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("user_id, email")
          .in("user_id", ownerAdminIds);
        for (const p of profiles ?? []) {
          const email = String((p as { email?: string }).email ?? "")
            .trim()
            .toLowerCase();
          if (email) emails.add(email);
        }
      }

      if (emails.size === 0) {
        skipped += 1;
        continue;
      }

      let metrics: SummaryRow = {};
      let gp: GrossProfitRow = {};

      if (includeSales) {
        const { data: reportData, error: reportErr } = await admin.rpc("pos_sales_summary_report", {
          p_organization_id: orgId,
          p_outlet_id: null,
          p_from: range.fromIso,
          p_to: range.toIso,
        });
        if (reportErr) throw reportErr;
        metrics = ((Array.isArray(reportData) ? reportData[0] : reportData) ??
          {}) as SummaryRow;
      }

      if (includeGrossProfit) {
        const { data: gpData, error: gpErr } = await admin.rpc("pos_gross_profit_report", {
          p_organization_id: orgId,
          p_outlet_id: null,
          p_from: range.fromIso,
          p_to: range.toIso,
        });
        if (gpErr) throw gpErr;
        gp = ((Array.isArray(gpData) ? gpData[0] : gpData) ?? {}) as GrossProfitRow;
      }

      const html = buildHtml({
        orgName,
        dateLabel: range.label,
        includeSales,
        includeGrossProfit,
        metrics,
        gp,
      });
      const subject = `[${orgName}] Daily Operations — ${range.label}`;

      const result = await sendResend({
        to: [...emails],
        subject,
        html,
      });
      if (!result.ok) {
        failed += 1;
        errors.push(`${orgId}: ${result.error}`);
        continue;
      }
      sent += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${orgId}: ${msg}`);
      console.error("daily sales email failed", orgId, e);
    }
  }

  return json({
    ok: true,
    range,
    orgs: (settingsRows ?? []).length,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
});
