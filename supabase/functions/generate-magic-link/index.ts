// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Payload = {
  userId?: string;
  email?: string;
  fullName?: string;
  organizationId?: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Server not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Require caller session (so only authenticated HR/admin/owner can invite)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const callerToken = authHeader.replace(/Bearer\s+/i, "");
    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerErr || !caller) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const userId = (body.userId ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.fullName ?? "").trim();
    const organizationId = (body.organizationId ?? "").trim();

    if (!userId) return json({ success: false, error: "userId is required" }, 400);
    if (!email || !email.includes("@")) return json({ success: false, error: "Invalid email" }, 400);
    if (!fullName) return json({ success: false, error: "fullName is required" }, 400);
    if (!organizationId) return json({ success: false, error: "organizationId is required" }, 400);

    // Permission guard: only privileged roles can generate invite links for an org
    const { data: callerRoleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const callerRole = (callerRoleRow?.role ?? "").toString().trim().toLowerCase();
    if (!["owner", "admin", "hr"].includes(callerRole)) {
      return json({ success: false, error: "Insufficient permissions" }, 403);
    }

    // Optional: keep profile aligned (best-effort)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email,
          full_name: fullName,
          active_organization_id: organizationId,
        },
        { onConflict: "user_id" }
      );

    // Opsi 1: create our own token + store in magic_links, then send user to /first-login to set password.
    const inviteToken = `${crypto.randomUUID()}-${Math.random().toString(36).slice(2, 12)}`;
    let magicLinkUrl: string | null = null;
    let emailError: string | null = null;
    let emailSent = false;
    let magicLinkRowId: string | null = null;

    const { data: row, error: insertErr } = await supabaseAdmin
      .from("magic_links")
      .insert({
        user_id: userId,
        email,
        token: inviteToken,
        email_verified: false,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("magic_links insert error:", insertErr);
      return json({ success: false, error: insertErr.message ?? "Failed to persist magic link" }, 500);
    }

    magicLinkRowId = (row as any)?.id ?? null;

    // Build base URL from referer/origin, fallback to SITE_URL
    const referer = req.headers.get("referer");
    const origin = req.headers.get("origin");
    let baseUrl = (Deno.env.get("SITE_URL") ?? "").trim();
    if (referer) {
      try {
        baseUrl = new URL(referer).origin;
      } catch {
        // ignore
      }
    } else if (origin) {
      baseUrl = origin;
    }
    if (!baseUrl) baseUrl = "http://localhost:8080";

    magicLinkUrl = `${baseUrl}/first-login?token=${encodeURIComponent(inviteToken)}&magic_link=true`;

    // Send invitation email (best-effort) using Resend if configured.
    if (magicLinkUrl) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

      if (!resendKey) {
        emailError = emailError ?? "RESEND_API_KEY is not configured (magic link generated but email not sent)";
      } else {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "You're invited to Synckerja Office",
              html: `
                <p>Hi ${escapeHtml(fullName || "there")},</p>
                <p>You have been invited to join Synckerja Office.</p>
                <p><a href="${magicLinkUrl}">Click here to sign in</a></p>
                <p style="color:#64748b;font-size:13px;">If you didn't expect this invitation, you can ignore this email.</p>
              `,
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("Resend error", res.status, text);
            emailError = text || "Resend request failed";
          } else {
            emailSent = true;
          }
        } catch (e: any) {
          console.error("Resend exception", e);
          emailError = e?.message ?? "Failed to send invitation email";
        }
      }
    }

    return json({
      success: Boolean(magicLinkUrl),
      token: inviteToken,
      magicLinkUrl: magicLinkUrl ?? undefined,
      magicLinkId: magicLinkRowId ?? undefined,
      emailSent,
      emailError,
    });
  } catch (e: any) {
    console.error("generate-magic-link error:", e);
    return json({ success: false, error: e?.message ?? "Unexpected error" }, 500);
  }
});

