import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetFirstDmMethod, LeadMagnetPlatform } from "./types.ts";

const META_GRAPH_VERSION = "v21.0";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

function deferDmPersistence(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(work);
    return;
  }
  void work;
}

export type LeadMagnetSendResult = {
  ok: boolean;
  messageId?: string | null;
  conversationId?: string | null;
  recipientId?: string | null;
  error?: string;
  isSessionExpired?: boolean;
  firstDmMethod?: LeadMagnetFirstDmMethod;
  privateReplyEndpoint?: string;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
};

type ButtonSpec =
  | { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

type MetaSendResponse = {
  ok: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
  isSessionExpired?: boolean;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
};

async function postMetaMessage(
  pageId: string,
  accessToken: string,
  recipientId: string,
  message: Record<string, unknown>,
): Promise<MetaSendResponse> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message,
    }),
  });
  const data = await res.json() as {
    message_id?: string;
    recipient_id?: string;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok) {
    const code = data.error?.code;
    const sub = data.error?.error_subcode;
    const isSessionExpired = code === 10 || sub === 2018278 || sub === 2534022;
    return {
      ok: false,
      error: data.error?.message ?? `Meta API ${res.status}`,
      isSessionExpired,
      metaErrorCode: code,
      metaErrorSubcode: sub,
    };
  }
  return { ok: true, messageId: data.message_id ?? null, recipientId: data.recipient_id ?? null };
}

/** First DM after an IG comment must use comment_id so Meta delivers inbox + push notification. */
async function postInstagramPrivateReply(
  endpointId: string,
  accessToken: string,
  commentId: string,
  message: Record<string, unknown>,
): Promise<MetaSendResponse> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${endpointId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message,
    }),
  });
  const data = await res.json() as {
    message_id?: string;
    recipient_id?: string;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok) {
    const code = data.error?.code;
    const sub = data.error?.error_subcode;
    const isSessionExpired = code === 10 || sub === 2018278 || sub === 2534022;
    console.warn("[lead-magnet] private reply failed:", {
      endpointId,
      commentId,
      code,
      sub,
      message: data.error?.message,
    });
    return {
      ok: false,
      error: data.error?.message ?? `Meta API ${res.status}`,
      isSessionExpired,
      metaErrorCode: code,
      metaErrorSubcode: sub,
    };
  }
  console.log("[lead-magnet] private reply sent:", {
    endpointId,
    commentId,
    messageId: data.message_id,
    recipientId: data.recipient_id,
  });
  return { ok: true, messageId: data.message_id ?? null, recipientId: data.recipient_id ?? null };
}

function buildButtonTemplate(text: string, buttons: ButtonSpec[]): Record<string, unknown> {
  const metaButtons = buttons.map((b) => {
    if (b.type === "postback") {
      return { type: "postback", title: b.title.slice(0, 20), payload: b.payload };
    }
    return { type: "web_url", title: b.title.slice(0, 20), url: b.url };
  });
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text.slice(0, 640),
        buttons: metaButtons,
      },
    },
  };
}

function appendButtonsAsPlainText(text: string, buttons?: ButtonSpec[]): string {
  if (!buttons?.length) return text;
  const lines = buttons.map((b) => {
    if (b.type === "web_url") return `${b.title}: ${b.url}`;
    return `Balas "${b.title}" untuk lanjut`;
  });
  return `${text}\n\n${lines.join("\n")}`;
}

async function sendInstagramFirstContactPrivateReply(
  pageId: string,
  accountId: string,
  accessToken: string,
  commentId: string,
  text: string,
  buttons?: ButtonSpec[],
): Promise<LeadMagnetSendResult> {
  const endpoints: Array<{ id: string; label: string }> = [
    { id: pageId, label: "page" },
    { id: accountId, label: "ig_business" },
  ];
  let lastError = "Private reply failed on all endpoints";
  let lastCode: number | undefined;
  let lastSub: number | undefined;
  let lastSessionExpired: boolean | undefined;

  for (const ep of endpoints) {
    if (buttons?.length) {
      const buttonMessage = buildButtonTemplate(text, buttons);
      const buttonResult = await postInstagramPrivateReply(ep.id, accessToken, commentId, buttonMessage);
      if (buttonResult.ok) {
        return {
          ok: true,
          messageId: buttonResult.messageId,
          recipientId: buttonResult.recipientId,
          firstDmMethod: "private_reply_button",
          privateReplyEndpoint: ep.label,
        };
      }
      lastError = buttonResult.error ?? lastError;
      lastCode = buttonResult.metaErrorCode ?? lastCode;
      lastSub = buttonResult.metaErrorSubcode ?? lastSub;
      lastSessionExpired = buttonResult.isSessionExpired ?? lastSessionExpired;
    }

    const textMessage = { text: appendButtonsAsPlainText(text, buttons).slice(0, 2000) };
    const textResult = await postInstagramPrivateReply(ep.id, accessToken, commentId, textMessage);
    if (textResult.ok) {
      return {
        ok: true,
        messageId: textResult.messageId,
        recipientId: textResult.recipientId,
        firstDmMethod: "private_reply_text",
        privateReplyEndpoint: ep.label,
      };
    }
    lastError = textResult.error ?? lastError;
    lastCode = textResult.metaErrorCode ?? lastCode;
    lastSub = textResult.metaErrorSubcode ?? lastSub;
    lastSessionExpired = textResult.isSessionExpired ?? lastSessionExpired;
  }

  return {
    ok: false,
    error: lastError,
    isSessionExpired: lastSessionExpired,
    metaErrorCode: lastCode,
    metaErrorSubcode: lastSub,
  };
}

async function upsertInstagramConversation(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    accountId: string;
    participantScopedId: string;
    participantUsername: string | null;
  },
): Promise<string | null> {
  const { data: existing } = await admin
    .from("instagram_conversations")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("instagram_business_account_id", args.accountId)
    .or(`customer_ig_id.eq.${args.participantScopedId},customer_external_id.eq.${args.participantScopedId}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const convId = crypto.randomUUID();
  const ticketId = "IG-" + convId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const now = new Date().toISOString();
  const orgOrGlobal = `organization_id.eq.${args.organizationId},organization_id.is.null`;
  const { data: openSt } = await admin.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();

  const { data: inserted, error } = await admin
    .from("instagram_conversations")
    .insert({
      id: convId,
      organization_id: args.organizationId,
      instagram_business_account_id: args.accountId,
      customer_ig_id: args.participantScopedId,
      customer_external_id: args.participantScopedId,
      ...(args.participantUsername ? { customer_name: args.participantUsername } : {}),
      ticket_id: ticketId,
      lead_status_id: openSt?.id ?? null,
      last_message_at: now,
      last_message_direction: "outbound",
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    const { data: retried } = await admin
      .from("instagram_conversations")
      .select("id")
      .eq("organization_id", args.organizationId)
      .eq("instagram_business_account_id", args.accountId)
      .or(`customer_ig_id.eq.${args.participantScopedId},customer_external_id.eq.${args.participantScopedId}`)
      .limit(1)
      .maybeSingle();
    return (retried?.id as string | undefined) ?? null;
  }
  return (inserted?.id as string | undefined) ?? null;
}

async function upsertFacebookConversation(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    pageId: string;
    participantScopedId: string;
    participantUsername: string | null;
  },
): Promise<string | null> {
  const { data: existing } = await admin
    .from("facebook_conversations")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("facebook_page_id", args.pageId)
    .eq("customer_psid", args.participantScopedId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const convId = crypto.randomUUID();
  const ticketId = "FB-" + convId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const now = new Date().toISOString();
  const orgOrGlobal = `organization_id.eq.${args.organizationId},organization_id.is.null`;
  const { data: openSt } = await admin.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();

  const { data: inserted, error } = await admin
    .from("facebook_conversations")
    .insert({
      id: convId,
      organization_id: args.organizationId,
      facebook_page_id: args.pageId,
      customer_psid: args.participantScopedId,
      ...(args.participantUsername ? { customer_name: args.participantUsername } : {}),
      ticket_id: ticketId,
      lead_status_id: openSt?.id ?? null,
      last_message_at: now,
      last_message_direction: "outbound",
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    const { data: retried } = await admin
      .from("facebook_conversations")
      .select("id")
      .eq("organization_id", args.organizationId)
      .eq("facebook_page_id", args.pageId)
      .eq("customer_psid", args.participantScopedId)
      .limit(1)
      .maybeSingle();
    return (retried?.id as string | undefined) ?? null;
  }
  return (inserted?.id as string | undefined) ?? null;
}

async function persistOutboundMessage(
  admin: SupabaseClient,
  platform: LeadMagnetPlatform,
  conversationId: string,
  body: string,
  messageId: string | null | undefined,
): Promise<void> {
  const now = new Date().toISOString();
  const table = platform === "instagram" ? "instagram_messages" : "facebook_messages";
  const payload: Record<string, unknown> = {
    conversation_id: conversationId,
    direction: "outbound",
    body: body.slice(0, 4000),
    message_type: "text",
    created_at: now,
  };
  if (messageId) payload.platform_message_id = messageId;

  await admin.from(table).insert(payload);
  const convTable = platform === "instagram" ? "instagram_conversations" : "facebook_conversations";
  await admin.from(convTable).update({
    last_message_at: now,
    last_message_body: body.slice(0, 200),
    last_message_direction: "outbound",
    updated_at: now,
  }).eq("id", conversationId);
}

export async function sendLeadMagnetDm(
  admin: SupabaseClient,
  args: {
    platform: LeadMagnetPlatform;
    organizationId: string;
    accountId: string;
    pageId: string;
    accessToken: string;
    recipientScopedId: string;
    participantUsername: string | null;
    text: string;
    buttons?: ButtonSpec[];
    existingConversationId?: string | null;
    commentIdForPrivateReply?: string | null;
    deferPersistence?: boolean;
  },
): Promise<LeadMagnetSendResult> {
  let conversationId = args.existingConversationId ?? null;
  if (!conversationId) {
    conversationId = args.platform === "instagram"
      ? await upsertInstagramConversation(admin, {
        organizationId: args.organizationId,
        accountId: args.accountId,
        participantScopedId: args.recipientScopedId,
        participantUsername: args.participantUsername,
      })
      : await upsertFacebookConversation(admin, {
        organizationId: args.organizationId,
        pageId: args.pageId,
        participantScopedId: args.recipientScopedId,
        participantUsername: args.participantUsername,
      });
  }

  const usePrivateReply = args.platform === "instagram"
    && Boolean(args.commentIdForPrivateReply?.trim())
    && !args.existingConversationId;

  let result: LeadMagnetSendResult;

  if (usePrivateReply) {
    result = await sendInstagramFirstContactPrivateReply(
      args.pageId,
      args.accountId,
      args.accessToken,
      args.commentIdForPrivateReply!.trim(),
      args.text,
      args.buttons,
    );
    if (!result.ok) {
      console.error("[lead-magnet] first-contact private reply exhausted, no recipient.id fallback:", result.error);
      return {
        ok: false,
        conversationId,
        error: result.error,
        isSessionExpired: result.isSessionExpired,
        metaErrorCode: result.metaErrorCode,
        metaErrorSubcode: result.metaErrorSubcode,
      };
    }
  } else {
    const message = args.buttons?.length
      ? buildButtonTemplate(args.text, args.buttons)
      : { text: args.text.slice(0, 2000) };
    const standard = await postMetaMessage(
      args.pageId,
      args.accessToken,
      args.recipientScopedId,
      message,
    );
    if (!standard.ok) {
      return {
        ok: false,
        conversationId,
        error: standard.error,
        isSessionExpired: standard.isSessionExpired,
        metaErrorCode: standard.metaErrorCode,
        metaErrorSubcode: standard.metaErrorSubcode,
      };
    }
    result = {
      ok: true,
      messageId: standard.messageId,
      recipientId: standard.recipientId,
      firstDmMethod: "standard",
    };
  }

  if (conversationId) {
    const persist = persistOutboundMessage(admin, args.platform, conversationId, args.text, result.messageId);
    if (args.deferPersistence) {
      deferDmPersistence(persist);
    } else {
      await persist;
    }
  }

  return { ok: true, messageId: result.messageId, conversationId, recipientId: result.recipientId, firstDmMethod: result.firstDmMethod, privateReplyEndpoint: result.privateReplyEndpoint };
}
