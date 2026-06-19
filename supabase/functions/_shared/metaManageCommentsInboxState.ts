import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MetaContentPlatform } from "./metaContentAuth.ts";

export type MetaInboxPostStateRow = {
  media_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type MetaInboxInboundCommentRow = {
  media_id: string;
  comment_id: string;
  detected_at: string;
};

export type MetaManageCommentsInboxState = {
  posts: MetaInboxPostStateRow[];
  inbound_comments: MetaInboxInboundCommentRow[];
  engaged_comment_ids: string[];
};

type PostBaselineInput = { media_id: string; comment_count: number };

function accountKey(platform: MetaContentPlatform, accountId: string) {
  return { platform, account_id: accountId };
}

export async function getMetaManageCommentsInboxState(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
): Promise<MetaManageCommentsInboxState> {
  const key = accountKey(platform, accountId);
  const [postsRes, inboundRes, engagedRes] = await Promise.all([
    admin.from("meta_manage_comments_post_inbox_state").select("*")
      .eq("organization_id", organizationId).eq("platform", key.platform).eq("account_id", key.account_id),
    admin.from("meta_manage_comments_inbound_comments").select("*")
      .eq("organization_id", organizationId).eq("platform", key.platform).eq("account_id", key.account_id),
    admin.from("meta_manage_comments_comment_engagements").select("comment_id")
      .eq("organization_id", organizationId).eq("platform", key.platform).eq("account_id", key.account_id),
  ]);
  if (postsRes.error) throw new Error(postsRes.error.message);
  if (inboundRes.error) throw new Error(inboundRes.error.message);
  if (engagedRes.error) throw new Error(engagedRes.error.message);

  return {
    posts: (postsRes.data ?? []).map((row) => ({
      media_id: String(row.media_id),
      last_known_comment_count: Number(row.last_known_comment_count ?? 0),
      is_highlighted: Boolean(row.is_highlighted),
      pinned_at: row.pinned_at ?? null,
    })),
    inbound_comments: (inboundRes.data ?? []).map((row) => ({
      media_id: String(row.media_id),
      comment_id: String(row.comment_id),
      detected_at: String(row.detected_at),
    })),
    engaged_comment_ids: (engagedRes.data ?? []).map((row) => String(row.comment_id)),
  };
}

async function clearInboundForMedia(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) return;
  const { error } = await admin
    .from("meta_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("account_id", accountId)
    .in("media_id", mediaIds);
  if (error) throw new Error(error.message);
}

export async function syncMetaManageCommentsPostBaselines(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  posts: PostBaselineInput[],
): Promise<MetaManageCommentsInboxState> {
  if (posts.length === 0) {
    return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
  }

  const mediaIds = posts.map((p) => p.media_id);
  const { data: existingRows, error: fetchErr } = await admin
    .from("meta_manage_comments_post_inbox_state")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("account_id", accountId)
    .in("media_id", mediaIds);
  if (fetchErr) throw new Error(fetchErr.message);

  const existingByMedia = new Map((existingRows ?? []).map((row) => [String(row.media_id), row]));
  const now = new Date().toISOString();

  const upserts = posts.map((post) => {
    const prev = existingByMedia.get(post.media_id);
    const prevCount = prev != null ? Number(prev.last_known_comment_count ?? 0) : null;
    const countIncreased = prevCount != null && post.comment_count > prevCount;
    const isNew = prev == null;
    let isHighlighted = Boolean(prev?.is_highlighted);
    let pinnedAt: string | null = prev?.pinned_at ?? null;
    if (post.comment_count === 0) {
      isHighlighted = false;
      pinnedAt = null;
    } else if (countIncreased) {
      isHighlighted = true;
      pinnedAt = now;
    } else if (isNew && post.comment_count > 0) {
      isHighlighted = false;
    }
    return {
      organization_id: organizationId,
      platform,
      account_id: accountId,
      media_id: post.media_id,
      last_known_comment_count: post.comment_count,
      is_highlighted: isHighlighted,
      thread_comments_seeded: Boolean(prev?.thread_comments_seeded),
      pinned_at: pinnedAt,
      updated_at: now,
    };
  });

  const { error: upsertErr } = await admin
    .from("meta_manage_comments_post_inbox_state")
    .upsert(upserts, { onConflict: "organization_id,platform,account_id,media_id" });
  if (upsertErr) throw new Error(upsertErr.message);

  await clearInboundForMedia(
    admin,
    organizationId,
    platform,
    accountId,
    posts.filter((p) => p.comment_count === 0).map((p) => p.media_id),
  );

  return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
}

export async function syncMetaManageCommentsInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
  commentIds: string[],
): Promise<MetaManageCommentsInboxState> {
  const uniqueIds = [...new Set(commentIds.map((id) => id.trim()).filter(Boolean))];
  const now = new Date().toISOString();

  if (uniqueIds.length === 0) {
    await clearInboundForMedia(admin, organizationId, platform, accountId, [mediaId]);
    const { data: postRow } = await admin
      .from("meta_manage_comments_post_inbox_state")
      .select("last_known_comment_count")
      .eq("organization_id", organizationId)
      .eq("platform", platform)
      .eq("account_id", accountId)
      .eq("media_id", mediaId)
      .maybeSingle();
    await admin.from("meta_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      platform,
      account_id: accountId,
      media_id: mediaId,
      last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
      is_highlighted: false,
      thread_comments_seeded: true,
      pinned_at: null,
      updated_at: now,
    }, { onConflict: "organization_id,platform,account_id,media_id" });
    return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
  }

  const rows = uniqueIds.map((commentId) => ({
    organization_id: organizationId,
    platform,
    account_id: accountId,
    media_id: mediaId,
    comment_id: commentId,
    detected_at: now,
  }));
  const { error } = await admin
    .from("meta_manage_comments_inbound_comments")
    .upsert(rows, { onConflict: "organization_id,platform,account_id,media_id,comment_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  await admin.from("meta_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    platform,
    account_id: accountId,
    media_id: mediaId,
    is_highlighted: true,
    pinned_at: now,
    thread_comments_seeded: true,
    updated_at: now,
  }, { onConflict: "organization_id,platform,account_id,media_id" });

  return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
}

export async function dismissMetaManageCommentsPostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
): Promise<MetaManageCommentsInboxState> {
  const now = new Date().toISOString();
  const { data: postRow } = await admin
    .from("meta_manage_comments_post_inbox_state")
    .select("last_known_comment_count, thread_comments_seeded")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("account_id", accountId)
    .eq("media_id", mediaId)
    .maybeSingle();

  await admin.from("meta_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    platform,
    account_id: accountId,
    media_id: mediaId,
    last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
    is_highlighted: false,
    thread_comments_seeded: Boolean(postRow?.thread_comments_seeded),
    pinned_at: null,
    updated_at: now,
  }, { onConflict: "organization_id,platform,account_id,media_id" });

  return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
}

export async function markMetaManageCommentsCommentRead(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
  commentId: string,
  userId: string,
): Promise<MetaManageCommentsInboxState> {
  const now = new Date().toISOString();
  await admin.from("meta_manage_comments_comment_engagements").upsert({
    organization_id: organizationId,
    platform,
    account_id: accountId,
    media_id: mediaId,
    comment_id: commentId,
    engagement_type: "read",
    engaged_by: userId,
    engaged_at: now,
  }, { onConflict: "organization_id,platform,account_id,media_id,comment_id" });

  await admin
    .from("meta_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("account_id", accountId)
    .eq("media_id", mediaId)
    .eq("comment_id", commentId);

  return getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
}
