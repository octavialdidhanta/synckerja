/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRequestUser, isOrgOwnerOrAdmin } from "../_shared/edgeCallerAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * The app still sends organizationName and verificationUrl, but they are IGNORED: both come from
 * the database so nobody can mail a fake organization name or a link to another site from our
 * domain. Only `email` (and optionally `organizationId`) is read.
 */
type Body = {
  email?: string;
  organizationId?: string;
  organizationName?: string;
  verificationUrl?: string;
};

type RecipientRow = {
  id: string;
  organization_id: string;
  email: string;
  verification_token: string | null;
  verification_expires_at: string | null;
  verified_at: string | null;
};

const DEFAULT_APP_ORIGIN = "https://office.synckerja.com";

/** Link origin: the caller's app origin when it is ours (prod, previews, localhost), else production. */
function appOrigin(req: Request): string {
  const configured = (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "").trim().replace(/\/+$/, "");
  const origin = (req.headers.get("origin") ?? "").trim().replace(/\/+$/, "");
  try {
    if (origin) {
      const u = new URL(origin);
      const host = u.hostname;
      const ours = host === "synckerja.com" || host.endsWith(".synckerja.com") ||
        host === "localhost" || host === "127.0.0.1";
      if (ours && (u.protocol === "https:" || host === "localhost" || host === "127.0.0.1")) return u.origin;
    }
  } catch {
    /* ignore malformed origin */
  }
  return configured || DEFAULT_APP_ORIGIN;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return json({ success: false, error: "email_required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
    if (!supabaseUrl || !serviceKey) {
      return json({ success: false, error: "server_not_configured" }, 500);
    }
    if (!resendKey) {
      return json({ success: false, error: "RESEND_API_KEY is not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Must be a signed-in user (the app calls this right after add_operational_email_recipient).
    const user = await getRequestUser(admin, req);
    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    // Pending recipient rows for this address that the user administers.
    let query = admin
      .from("operational_email_recipients")
      .select("id, organization_id, email, verification_token, verification_expires_at, verified_at")
      .eq("email", email)
      .is("verified_at", null)
      .not("verification_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const orgFilter = body.organizationId?.trim();
    if (orgFilter) query = query.eq("organization_id", orgFilter);
    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) throw rowsErr;

    let recipient: RecipientRow | null = null;
    for (const row of (rows ?? []) as RecipientRow[]) {
      if (await isOrgOwnerOrAdmin(admin, user.id, row.organization_id)) {
        recipient = row;
        break;
      }
    }
    if (!recipient?.verification_token) {
      return json({ success: false, error: "recipient_not_found" }, 404);
    }
    if (recipient.verification_expires_at && new Date(recipient.verification_expires_at).getTime() < Date.now()) {
      return json({ success: false, error: "verification_expired" }, 410);
    }

    const { data: org } = await admin
      .from("organizations")
      .select("company_name")
      .eq("id", recipient.organization_id)
      .maybeSingle();
    const organizationName =
      ((org as { company_name?: string | null } | null)?.company_name ?? "").trim() || "your organization";
    const verificationUrl =
      `${appOrigin(req)}/verify-operational-email?token=${encodeURIComponent(recipient.verification_token)}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient.email],
        subject: `Verify your email for ${organizationName} operational alerts`,
        html: `
          <p>Hello,</p>
          <p>You have been invited to receive operational email notifications for <strong>${escapeHtml(organizationName)}</strong>.</p>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${escapeHtml(verificationUrl)}" style="color:#2074B6;font-weight:600;">Verify email address</a></p>
          <p style="color:#64748b;font-size:13px;">This link expires in 7 days. If you did not expect this email, you can ignore it.</p>
          <p style="color:#64748b;font-size:13px;">If the button does not work, copy and paste this URL into your browser:<br/>${escapeHtml(verificationUrl)}</p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error", res.status, text.slice(0, 500));
      return json({ success: false, error: "resend_failed" }, 502);
    }

    return json({ success: true });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return json({ success: false, error: "Unknown error" }, 500);
  }
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
