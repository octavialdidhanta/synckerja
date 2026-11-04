/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  email?: string;
  fullName?: string;
  confirmationUrl?: string;
};

type Issued = {
  ok?: boolean;
  token?: string;
  error?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() ?? "";

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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("issue_new_verification_token", {
      p_email: email,
    });
    if (error) {
      console.error("issue_new_verification_token", error.message);
      return json({ success: false, error: "token_issue_failed" }, 502);
    }

    const issued = data as Issued | null;
    const token = issued?.token?.trim();
    if (!issued?.ok || !token) {
      const code = issued?.error === "user_not_found" ? "user_not_found" : "token_issue_failed";
      return json({ success: false, error: code }, code === "user_not_found" ? 404 : 502);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Verify your Synckerja Office account",
        html: `
          <p>Hi ${escapeHtml(fullName || "there")},</p>
          <p>Your email verification code is:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:0.35em;font-family:ui-monospace,monospace;color:#2074B6;margin:24px 0;">
            ${escapeHtml(token)}
          </p>
          <p>Enter this 6-digit code on the <strong>Verify your email</strong> page in Synckerja Office.</p>
          <p style="color:#64748b;font-size:13px;">This code expires in 24 hours. If you did not create an account, you can ignore this message.</p>
        `,
      }),
    });

    if (!res.ok) {
      await res.text();
      console.error("Resend error", res.status);
      return json({ success: false, error: "resend_failed" }, 502);
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error(e instanceof Error ? e.message : "send-confirmation-email failed");
    return json({ success: false, error: "Unknown error" }, 500);
  }
});

function json(body: { success: boolean; error?: string }, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
