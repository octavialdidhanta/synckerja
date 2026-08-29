/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  email?: string;
  organizationName?: string;
  verificationUrl?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const email = body.email?.trim().toLowerCase();
    const organizationName = body.organizationName?.trim() ?? "your organization";
    const verificationUrl = body.verificationUrl?.trim();

    if (!email || !verificationUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "email and verificationUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

    if (!resendKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      console.error("Resend error", res.status, text);
      return new Response(
        JSON.stringify({ success: false, error: text || "Resend request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
