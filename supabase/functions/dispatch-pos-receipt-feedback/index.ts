/**
 * Dispatch digital receipt + feedback link via email (Resend) and SMS (Twilio).
 *
 * Deploy: `supabase functions deploy dispatch-pos-receipt-feedback --no-verify-jwt`
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL,
 *          POS_RECEIPT_PUBLIC_BASE_URL (preferred) or APP_BASE_URL,
 *          TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import {
  buildReceiptEmailHtml,
  buildReceiptEmailSubject,
} from "./buildReceiptEmailHtml.ts";
import { loadReceiptPayload } from "./loadReceiptPayload.ts";

type Body = {
  invitationId?: string;
};

function buildReceiptUrl(token: string): string {
  const base = (
    Deno.env.get("POS_RECEIPT_PUBLIC_BASE_URL") ??
    Deno.env.get("APP_BASE_URL") ??
    "https://office.synckerja.com"
  ).replace(/\/+$/, "");
  return `${base}/r/${token}`;
}

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [args.to],
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

async function sendSms(args: {
  to: string;
  businessName: string;
  receiptUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: "Twilio is not configured" };
  }

  const toE164 = args.to.startsWith("+")
    ? args.to
    : `+${args.to.replace(/\D/g, "")}`;
  const body = `${args.businessName}: Lihat struk & beri feedback: ${args.receiptUrl}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);
  const form = new URLSearchParams({ To: toE164, From: fromNumber, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || "Twilio request failed" };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const invitationId = body.invitationId?.trim();
    if (!invitationId) {
      return new Response(JSON.stringify({ success: false, error: "invitationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "Supabase env missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: inv, error: invErr } = await admin
      .from("pos_receipt_feedback_invitations")
      .select(
        "id, organization_id, sales_activity_id, pos_outlet_id, public_token, customer_email, customer_phone, customer_name, share_via_email, share_via_sms, email_status, sms_status",
      )
      .eq("id", invitationId)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!inv) {
      return new Response(JSON.stringify({ success: false, error: "invitation_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const receiptUrl = buildReceiptUrl(String(inv.public_token));
    const payload = await loadReceiptPayload(admin, {
      sales_activity_id: String(inv.sales_activity_id),
      organization_id: String(inv.organization_id),
      pos_outlet_id: inv.pos_outlet_id != null ? String(inv.pos_outlet_id) : null,
      customer_name: inv.customer_name != null ? String(inv.customer_name) : null,
    });

    const businessName = payload?.businessName ?? "Store";
    const errors: string[] = [];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (inv.share_via_email && inv.email_status === "pending_send" && inv.customer_email) {
      if (!payload) {
        patch.email_status = "send_failed";
        errors.push("email: receipt_payload_missing");
      } else {
        const html = buildReceiptEmailHtml({ payload, receiptUrl });
        const result = await sendEmail({
          to: String(inv.customer_email),
          subject: buildReceiptEmailSubject(businessName),
          html,
        });
        if (result.ok) {
          patch.email_status = "sent";
          patch.email_sent_at = new Date().toISOString();
        } else {
          patch.email_status = "send_failed";
          errors.push(`email: ${result.error}`);
        }
      }
    }

    if (inv.share_via_sms && inv.sms_status === "pending_send" && inv.customer_phone) {
      const result = await sendSms({
        to: String(inv.customer_phone),
        businessName,
        receiptUrl,
      });
      if (result.ok) {
        patch.sms_status = "sent";
        patch.sms_sent_at = new Date().toISOString();
      } else {
        patch.sms_status = "send_failed";
        errors.push(`sms: ${result.error}`);
      }
    }

    if (errors.length > 0) {
      patch.error_message = errors.join("; ").slice(0, 2000);
    }

    await admin.from("pos_receipt_feedback_invitations").update(patch).eq("id", invitationId);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        receiptUrl,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
