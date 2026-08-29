/**
 * Dispatch shift recap email via Resend after pos_end_shift.
 *
 * Deploy: `supabase functions deploy dispatch-pos-shift-recap --no-verify-jwt`
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import {
  buildShiftRecapEmailHtml,
  buildShiftRecapEmailSubject,
  type ShiftDetailPayload,
} from "./buildShiftRecapEmailHtml.ts";
import { resolveShiftRecapRecipients } from "./resolveShiftRecapRecipients.ts";

type Body = {
  shiftId?: string;
  dispatchId?: string;
};

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
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY is not configured" };
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

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: text || "Resend request failed" };
  }

  let messageId: string | undefined;
  try {
    const parsed = JSON.parse(text) as { id?: string };
    messageId = parsed.id;
  } catch {
    /* ignore */
  }

  return { ok: true, messageId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let requestShiftId: string | undefined;
  let requestDispatchId: string | undefined;

  try {
    const body = (await req.json()) as Body;
    requestShiftId = body.shiftId?.trim();
    requestDispatchId = body.dispatchId?.trim();
    const shiftId = requestShiftId;
    const dispatchId = requestDispatchId;

    if (!shiftId && !dispatchId) {
      return json({ success: false, error: "shiftId or dispatchId required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ success: false, error: "Supabase env missing" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let dispatchQuery = admin
      .from("pos_shift_email_dispatches")
      .select(
        "id, shift_id, organization_id, outlet_id, language, status, recipient_count, sent_at",
      );

    if (dispatchId) {
      dispatchQuery = dispatchQuery.eq("id", dispatchId);
    } else {
      dispatchQuery = dispatchQuery.eq("shift_id", shiftId!);
    }

    const { data: dispatch, error: dispatchErr } = await dispatchQuery.maybeSingle();
    if (dispatchErr) throw dispatchErr;
    if (!dispatch) {
      return json({ success: false, error: "dispatch_not_found" }, 404);
    }

    if (dispatch.status === "sent") {
      return json({ success: true, skipped: true, reason: "already_sent" });
    }
    if (dispatch.status === "skipped_disabled") {
      return json({ success: true, skipped: true, reason: "disabled" });
    }

    const resolvedShiftId = String(dispatch.shift_id);
    const orgId = String(dispatch.organization_id);
    const language = String(dispatch.language ?? "id");
    const dispatchRowId = String(dispatch.id);

    const { data: detailRaw, error: detailErr } = await admin.rpc("pos_shift_detail", {
      p_shift_id: resolvedShiftId,
    });
    if (detailErr) {
      await admin
        .from("pos_shift_email_dispatches")
        .update({
          status: "send_failed",
          error_message: detailErr.message ?? "pos_shift_detail_failed",
        })
        .eq("id", dispatchRowId);
      throw detailErr;
    }

    const detail = (detailRaw ?? {}) as ShiftDetailPayload;

    const { data: org } = await admin
      .from("organizations")
      .select("company_name")
      .eq("id", orgId)
      .maybeSingle();

    const orgName = String((org as { company_name?: string } | null)?.company_name ?? "Organization");

    const closedByUserId =
      detail.closed_by_user_id != null ? String(detail.closed_by_user_id) : null;

    const recipients = await resolveShiftRecapRecipients(admin, orgId, closedByUserId);

    if (recipients.length === 0) {
      await admin
        .from("pos_shift_email_dispatches")
        .update({
          status: "send_failed",
          error_message: "no_recipients",
          recipient_count: 0,
        })
        .eq("id", dispatch.id);
      return json({ success: false, error: "no_recipients" }, 422);
    }

    const html = buildShiftRecapEmailHtml({ detail, orgName, language });
    const subject = buildShiftRecapEmailSubject(detail, language);

    const sendResult = await sendResend({ to: recipients, subject, html });

    if (!sendResult.ok) {
      await admin
        .from("pos_shift_email_dispatches")
        .update({
          status: "send_failed",
          error_message: sendResult.error ?? "send_failed",
          recipient_count: recipients.length,
        })
        .eq("id", dispatch.id);
      return json({ success: false, error: sendResult.error }, 500);
    }

    await admin
      .from("pos_shift_email_dispatches")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: recipients.length,
        resend_message_id: sendResult.messageId ?? null,
        error_message: null,
      })
      .eq("id", dispatch.id);

    return json({
      success: true,
      recipientCount: recipients.length,
      messageId: sendResult.messageId,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey && (requestShiftId || requestDispatchId)) {
        const admin = createClient(supabaseUrl, serviceKey);
        let q = admin.from("pos_shift_email_dispatches").update({
          status: "send_failed",
          error_message: message.slice(0, 500),
        });
        if (requestDispatchId) {
          q = q.eq("id", requestDispatchId);
        } else if (requestShiftId) {
          q = q.eq("shift_id", requestShiftId);
        }
        await q.neq("status", "sent");
      }
    } catch {
      /* best-effort audit update */
    }
    return json({ success: false, error: message }, 500);
  }
});
