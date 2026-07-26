import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractEmailFromMessageBody } from "../leadMagnet/contactGate/parseContactReply.ts";

export type LivechatEmailFillChannel = "whatsapp" | "instagram" | "facebook";

const CHANNEL_CONFIG: Record<
  LivechatEmailFillChannel,
  { conversationTable: string; ticketPrefix: string; fallbackName: string }
> = {
  whatsapp: {
    conversationTable: "whatsapp_conversations",
    ticketPrefix: "WA-",
    fallbackName: "WhatsApp",
  },
  instagram: {
    conversationTable: "instagram_conversations",
    ticketPrefix: "IG-",
    fallbackName: "Instagram",
  },
  facebook: {
    conversationTable: "facebook_conversations",
    ticketPrefix: "FB-",
    fallbackName: "Messenger",
  },
};

/** Same convention as conversation ticket generation: PREFIX + first 8 hex of conversation UUID. */
export function deriveLivechatTicketId(
  channel: LivechatEmailFillChannel,
  conversationId: string,
): string {
  return (
    CHANNEL_CONFIG[channel].ticketPrefix +
    String(conversationId).replace(/-/g, "").slice(0, 8).toUpperCase()
  );
}

export function hasEmailValue(email: string | null | undefined): boolean {
  return email != null && String(email).trim() !== "";
}

export type EmailFillSources = {
  submissionEmail?: string | null;
  leadEmail?: string | null;
  waProfileEmail?: string | null;
  detectedEmail: string;
};

/**
 * Fill-empty-only policy: an email already stored anywhere wins and is used to
 * backfill the other (empty) stores; the detected email is used only when every
 * store is still empty. Reprocessing the same message is therefore idempotent.
 */
export function resolveCanonicalEmailForFill(sources: EmailFillSources): string {
  if (hasEmailValue(sources.submissionEmail)) return String(sources.submissionEmail).trim();
  if (hasEmailValue(sources.leadEmail)) return String(sources.leadEmail).trim();
  if (hasEmailValue(sources.waProfileEmail)) return String(sources.waProfileEmail).trim();
  return sources.detectedEmail;
}

export type SubmissionRowForEmailFill = {
  id: string;
  email: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string | null;
  is_active?: boolean | null;
};

function submissionSortKey(row: SubmissionRowForEmailFill): string {
  return `${row.submitted_at ?? ""}\0${row.updated_at ?? ""}`;
}

/** Same pick order as the Client Profile modal: latest submitted, then latest draft. */
export function pickSubmissionForEmailFill(
  rows: SubmissionRowForEmailFill[],
): SubmissionRowForEmailFill | null {
  const active = rows.filter((r) => r.is_active !== false);
  const submitted = active
    .filter((r) => r.status === "submitted")
    .sort((a, b) => submissionSortKey(b).localeCompare(submissionSortKey(a)));
  if (submitted.length > 0) return submitted[0];
  const draft = active
    .filter((r) => r.status === "draft")
    .sort((a, b) => submissionSortKey(b).localeCompare(submissionSortKey(a)));
  return draft[0] ?? null;
}

/** PostgREST filter: only rows whose email is still NULL or empty (guards against races/manual edits). */
const EMAIL_EMPTY_OR_FILTER = 'email.is.null,email.eq.""';

async function createDraftSubmissionWithEmail(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    leadId: string;
    channel: LivechatEmailFillChannel;
    conversationId: string;
    email: string;
    name: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const basePayload: Record<string, unknown> = {
    organization_id: args.organizationId,
    lead_id: args.leadId,
    web_id: null,
    form_id: null,
    name: args.name,
    email: args.email,
    phone_number: null,
    notes: "Email auto-detected from livechat message",
    status: "draft",
    is_active: true,
    updated_at: now,
    ...(args.channel === "whatsapp" ? { whatsapp_conversation_id: args.conversationId } : {}),
  };

  const { error } = await admin.from("lead_submissions").insert(basePayload);
  if (!error) return;

  // Some remote schemas keep web_id/form_id NOT NULL — retry once with sibling org values.
  const message = String(error.message ?? "");
  if (!/web_id|form_id/i.test(message)) {
    console.warn("[livechat] email fill: draft submission insert failed", message);
    return;
  }

  const { data: sibling } = await admin
    .from("lead_submissions")
    .select("web_id, form_id")
    .eq("organization_id", args.organizationId)
    .not("web_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sibling?.web_id) {
    console.warn("[livechat] email fill: no resolvable web_id for draft submission", {
      leadId: args.leadId,
    });
    return;
  }

  const { error: retryErr } = await admin.from("lead_submissions").insert({
    ...basePayload,
    web_id: sibling.web_id,
    form_id: sibling.form_id ?? null,
  });
  if (retryErr) {
    console.warn(
      "[livechat] email fill: draft submission retry failed",
      String(retryErr.message ?? ""),
    );
  }
}

/**
 * Detect an email in an inbound livechat message and fill Client Profile stores
 * (lead_submissions, leads mirror, WA conversation client profile) — only when
 * the email field is still empty. Never throws; webhook persistence must not be
 * affected by this side effect.
 */
export async function fillClientProfileEmailFromInboundMessage(
  admin: SupabaseClient,
  args: {
    channel: LivechatEmailFillChannel;
    organizationId: string;
    conversationId: string;
    messageBody: string | null | undefined;
  },
): Promise<void> {
  try {
    const detectedEmail = extractEmailFromMessageBody(args.messageBody);
    if (!detectedEmail) return;

    const cfg = CHANNEL_CONFIG[args.channel];
    const { data: conv } = await admin
      .from(cfg.conversationTable)
      .select("ticket_id, customer_name")
      .eq("id", args.conversationId)
      .eq("organization_id", args.organizationId)
      .maybeSingle();
    if (!conv) return;

    const ticketId =
      String((conv as { ticket_id?: string | null }).ticket_id ?? "").trim() ||
      deriveLivechatTicketId(args.channel, args.conversationId);

    const { data: lead } = await admin
      .from("leads")
      .select("id, client, email")
      .eq("organization_id", args.organizationId)
      .eq("ticket_id", ticketId)
      .maybeSingle();

    let waProfile: { id: string; email: string | null } | null = null;
    if (args.channel === "whatsapp") {
      const { data } = await admin
        .from("whatsapp_conversation_client_profiles")
        .select("id, email")
        .eq("conversation_id", args.conversationId)
        .eq("organization_id", args.organizationId)
        .maybeSingle();
      waProfile = (data as { id: string; email: string | null } | null) ?? null;
    }

    let submission: SubmissionRowForEmailFill | null = null;
    if (lead?.id) {
      const { data: rows } = await admin
        .from("lead_submissions")
        .select("id, email, status, submitted_at, updated_at, is_active")
        .eq("organization_id", args.organizationId)
        .eq("lead_id", lead.id)
        .eq("is_active", true);
      submission = pickSubmissionForEmailFill((rows ?? []) as SubmissionRowForEmailFill[]);
    }

    const canonicalEmail = resolveCanonicalEmailForFill({
      submissionEmail: submission?.email,
      leadEmail: (lead as { email?: string | null } | null)?.email,
      waProfileEmail: waProfile?.email,
      detectedEmail,
    });
    const now = new Date().toISOString();

    const customerName =
      String((conv as { customer_name?: string | null }).customer_name ?? "").trim() ||
      String((lead as { client?: string | null } | null)?.client ?? "").trim() ||
      cfg.fallbackName;

    if (submission) {
      if (!hasEmailValue(submission.email)) {
        const { error } = await admin
          .from("lead_submissions")
          .update({ email: canonicalEmail, updated_at: now })
          .eq("id", submission.id)
          .or(EMAIL_EMPTY_OR_FILTER);
        if (error) {
          console.warn("[livechat] email fill: submission update failed", error.message);
        }
      }
    } else if (lead?.id) {
      await createDraftSubmissionWithEmail(admin, {
        organizationId: args.organizationId,
        leadId: lead.id,
        channel: args.channel,
        conversationId: args.conversationId,
        email: canonicalEmail,
        name: customerName,
      });
    }

    if (lead?.id && !hasEmailValue((lead as { email?: string | null }).email)) {
      const { error } = await admin
        .from("leads")
        .update({ email: canonicalEmail, updated_at: now })
        .eq("id", lead.id)
        .eq("organization_id", args.organizationId)
        .or(EMAIL_EMPTY_OR_FILTER);
      if (error) {
        console.warn("[livechat] email fill: leads mirror update failed", error.message);
      }
    }

    if (args.channel === "whatsapp") {
      if (waProfile?.id) {
        if (!hasEmailValue(waProfile.email)) {
          const { error } = await admin
            .from("whatsapp_conversation_client_profiles")
            .update({ email: canonicalEmail, updated_at: now })
            .eq("id", waProfile.id)
            .or(EMAIL_EMPTY_OR_FILTER);
          if (error) {
            console.warn("[livechat] email fill: WA profile update failed", error.message);
          }
        }
      } else {
        const { error } = await admin.from("whatsapp_conversation_client_profiles").insert({
          conversation_id: args.conversationId,
          organization_id: args.organizationId,
          name: customerName,
          email: canonicalEmail,
          updated_at: now,
        });
        if (error) {
          console.warn("[livechat] email fill: WA profile insert failed", error.message);
        }
      }
    }
  } catch (err) {
    console.error("[livechat] fillClientProfileEmailFromInbound error", err);
  }
}
