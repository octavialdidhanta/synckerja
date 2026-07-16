import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetPlatform } from "./types.ts";
import { invokeLeadMagnetRuntime, runLeadMagnetRuntime } from "./runLeadMagnetRuntime.ts";
import type { LeadMagnetCommentTriggerInput, LeadMagnetPostbackTriggerInput } from "./types.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

/** Run non-critical lead-magnet work after the user-visible reply (comment/DM). */
export function deferLeadMagnetWork(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(work);
    return;
  }
  void work;
}

export type FacebookFeedCommentEvent = {
  commentId: string;
  postId: string;
  authorScopedId: string | null;
  authorUsername: string | null;
  commentText: string;
  verb: string | null;
};

export function extractFacebookFeedCommentChangesFromEntry(
  entry: Record<string, unknown>,
): FacebookFeedCommentEvent[] {
  const events: FacebookFeedCommentEvent[] = [];
  const changes = entry.changes;
  if (!Array.isArray(changes)) return events;

  for (const ch of changes) {
    const change = ch as Record<string, unknown>;
    const field = typeof change.field === "string" ? change.field : "";
    if (field !== "feed") continue;

    const val = change.value as Record<string, unknown> | undefined;
    if (!val) continue;

    const item = typeof val.item === "string" ? val.item.trim().toLowerCase() : "";
    if (item !== "comment") continue;

    const commentId = typeof val.comment_id === "string"
      ? val.comment_id.trim()
      : String(val.comment_id ?? val.id ?? "").trim();
    const postId = typeof val.post_id === "string"
      ? val.post_id.trim()
      : String(val.post_id ?? "").trim();
    const message = typeof val.message === "string" ? val.message.trim() : "";
    const from = val.from as Record<string, unknown> | undefined;
    const authorScopedId = from?.id != null ? String(from.id).trim() : null;
    const authorUsername = typeof from?.name === "string" ? from.name.trim() : null;
    const verb = typeof val.verb === "string" ? val.verb.trim().toLowerCase() : null;

    if (!commentId || !postId) continue;

    events.push({
      commentId,
      postId,
      authorScopedId,
      authorUsername,
      commentText: message,
      verb,
    });
  }

  return events;
}

function scheduleLeadMagnet(
  input: LeadMagnetCommentTriggerInput | LeadMagnetPostbackTriggerInput,
  admin?: SupabaseClient,
): void {
  const promise = admin
    ? runLeadMagnetRuntime(admin, input)
    : invokeLeadMagnetRuntime(input);
  deferLeadMagnetWork(promise);
}

export function scheduleLeadMagnetCommentTrigger(
  args: {
  platform: LeadMagnetPlatform;
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentId: string;
  authorScopedId: string;
  authorUsername: string | null;
  commentText: string;
  accessToken: string;
  pageId: string;
  },
  admin?: SupabaseClient,
): void {
  scheduleLeadMagnet({
    trigger: "comment",
    platform: args.platform,
    organizationId: args.organizationId,
    accountId: args.accountId,
    mediaId: args.mediaId,
    commentId: args.commentId,
    authorScopedId: args.authorScopedId,
    authorUsername: args.authorUsername,
    commentText: args.commentText,
    accessToken: args.accessToken,
    pageId: args.pageId,
  }, admin);
}

export function scheduleLeadMagnetPostbackTrigger(
  args: {
  platform: LeadMagnetPlatform;
  organizationId: string;
  accountId: string;
  participantScopedId: string;
  participantUsername: string | null;
  payload: string;
  conversationId?: string | null;
  accessToken: string;
  pageId: string;
  },
  admin?: SupabaseClient,
): void {
  scheduleLeadMagnet({
    trigger: "postback",
    platform: args.platform,
    organizationId: args.organizationId,
    accountId: args.accountId,
    participantScopedId: args.participantScopedId,
    participantUsername: args.participantUsername,
    payload: args.payload,
    conversationId: args.conversationId ?? null,
    accessToken: args.accessToken,
    pageId: args.pageId,
  }, admin);
}
