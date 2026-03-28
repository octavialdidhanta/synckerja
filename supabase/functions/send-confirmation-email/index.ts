import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  email?: string;
  fullName?: string;
  confirmationUrl?: string;
  token?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() ?? "";
    const token = body.token?.trim();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "email and token are required" }),
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

    const codeHtml = `
          <p style="font-size:32px;font-weight:700;letter-spacing:0.35em;font-family:ui-monospace,monospace;color:#2074B6;margin:24px 0;">
            ${escapeHtml(token)}
          </p>`;

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
          ${codeHtml}
          <p>Enter this 6-digit code on the <strong>Verify your email</strong> page in Synckerja Office.</p>
          <p style="color:#64748b;font-size:13px;">This code expires in 24 hours. If you did not create an account, you can ignore this message.</p>
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
