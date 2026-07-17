import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDeliveryContext, interpolateDeliveryTemplate } from "./buildDeliveryContext.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";

const RESEND_SANDBOX_FROM = "onboarding@resend.dev";

function extractBareFromEmail(fromEmail: string): string {
  const trimmed = fromEmail.trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return trimmed;
}

function formatResendFrom(displayName: string | undefined, fromEmail: string): string {
  const bareEmail = extractBareFromEmail(fromEmail);
  const name = displayName?.trim() || "Synckerja";
  return `${name} <${bareEmail}>`;
}

function isResendDomainNotVerifiedError(status: number, body: string): boolean {
  if (status !== 403) return false;
  return body.toLowerCase().includes("domain is not verified");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(template: string, ctx: { deliveryUrl: string }): string {
  const interpolated = template.trim();
  if (/<[a-z][\s\S]*>/i.test(interpolated)) {
    if (
      !interpolated.includes("{{delivery_url}}")
      && !interpolated.includes(ctx.deliveryUrl)
    ) {
      return `${interpolated}<p><a href="${escapeHtml(ctx.deliveryUrl)}">Unduh materi</a></p>`;
    }
    return interpolated;
  }
  const bodyHtml = escapeHtml(interpolated)
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
  return `${bodyHtml}<p><a href="${escapeHtml(ctx.deliveryUrl)}">Unduh materi</a></p>`;
}

function formatResendError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string };
    const message = String(parsed.message ?? body);
    if (message.toLowerCase().includes("testing mode")) {
      return `${message} (Resend sandbox: gunakan email yang terdaftar di akun Resend, atau verifikasi domain di resend.com/domains)`;
    }
    return message;
  } catch {
    return body;
  }
}

async function resolveOrgEmailFrom(
  admin: SupabaseClient,
  organizationId: string,
  campaignFromName: string | null | undefined,
): Promise<{ from: string; displayName?: string; fromEmail: string }> {
  const { data: org } = await admin
    .from("organizations")
    .select("lead_magnet_email_from, lead_magnet_email_from_name, company_name")
    .eq("id", organizationId)
    .maybeSingle();

  const orgFromRaw = String(org?.lead_magnet_email_from ?? "").trim();
  const envFromRaw = (Deno.env.get("RESEND_FROM_EMAIL") ?? RESEND_SANDBOX_FROM).trim();
  const fromEmail = extractBareFromEmail(orgFromRaw || envFromRaw);
  const displayName = campaignFromName?.trim()
    || String(org?.lead_magnet_email_from_name ?? "").trim()
    || String(org?.company_name ?? "").trim()
    || undefined;

  return {
    from: formatResendFrom(displayName, fromEmail),
    displayName,
    fromEmail,
  };
}

async function sendResendEmail(args: {
  resendKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export async function deliverViaEmail(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    email: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const to = args.email.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "Invalid recipient email" };
  }

  const ctx = await buildDeliveryContext(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
  });

  const subjectTemplate = args.campaign.email_subject?.trim()
    || "Materi {{campaign_name}} — Synckerja";
  const htmlTemplate = args.campaign.email_html_body?.trim()
    || `<p>Hai {{username}},</p><p>Terima kasih! Berikut link materi kamu:</p><p><a href="{{delivery_url}}">{{delivery_url}}</a></p>`;

  const subject = interpolateDeliveryTemplate(subjectTemplate, ctx);
  const html = buildEmailHtml(interpolateDeliveryTemplate(htmlTemplate, ctx), ctx);

  const { from, displayName, fromEmail } = await resolveOrgEmailFrom(
    admin,
    args.enrollment.organization_id,
    args.campaign.email_from_name,
  );

  let result = await sendResendEmail({ resendKey, from, to, subject, html });

  if (
    !result.ok
    && isResendDomainNotVerifiedError(result.status, result.body)
    && !fromEmail.endsWith("@resend.dev")
  ) {
    const fallbackFrom = formatResendFrom(displayName, RESEND_SANDBOX_FROM);
    console.warn("[lead-magnet] Resend domain not verified; retrying with sandbox from", fallbackFrom);
    result = await sendResendEmail({ resendKey, from: fallbackFrom, to, subject, html });
  }

  if (!result.ok) {
    console.error("[lead-magnet] Resend error", result.status, result.body);
    return { ok: false, error: formatResendError(result.body) || "Resend request failed" };
  }
  return { ok: true };
}
