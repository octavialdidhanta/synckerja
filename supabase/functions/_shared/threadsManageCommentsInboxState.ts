import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ThreadsInboxPostStateRow = {
  media_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type ThreadsInboxInboundCommentRow = {
  media_id: string;
  comment_id: string;
  detected_at: string;
};

export type ThreadsManageCommentsInboxState = {
  posts: ThreadsInboxPostStateRow[];
  inbound_comments: ThreadsInboxInboundCommentRow[];
  engaged_comment_ids: string[];
};

type PostBaselineInput = { media_id: string; comment_count: number };

export async function getThreadsManageCommentsInboxState(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
): Promise<ThreadsManageCommentsInboxState> {
  const [postsRes, inboundRes, engagedRes] = await Promise.all([
    admin.from("threads_manage_comments_post_inbox_state").select("*")
      .eq("organization_id", organizationId).eq("threads_user_id", threadsUserId),
    admin.from("threads_manage_comments_inbound_comments").select("*")
      .eq("organization_id", organizationId).eq("threads_user_id", threadsUserId),
    admin.from("threads_manage_comments_comment_engagements").select("comment_id")
      .eq("organization_id", organizationId).eq("threads_user_id", threadsUserId),
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
  threadsUserId: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) return;
  const { error } = await admin
    .from("threads_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .in("media_id", mediaIds);
  if (error) throw new Error(error.message);
}

export async function syncThreadsManageCommentsPostBaselines(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  posts: PostBaselineInput[],
): Promise<ThreadsManageCommentsInboxState> {
  if (posts.length === 0) {
    return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
  }

  const mediaIds = posts.map((p) => p.media_id);
  const { data: existingRows, error: fetchErr } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
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
      threads_user_id: threadsUserId,
      media_id: post.media_id,
      last_known_comment_count: post.comment_count,
      is_highlighted: isHighlighted,
      pinned_at: pinnedAt,
      updated_at: now,
    };
  });

  const { error: upsertErr } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .upsert(upserts, { onConflict: "organization_id,threads_user_id,media_id" });
  if (upsertErr) throw new Error(upsertErr.message);

  await clearInboundForMedia(
    admin,
    organizationId,
    threadsUserId,
    posts.filter((p) => p.comment_count === 0).map((p) => p.media_id),
  );

  return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
}

export async function syncThreadsManageCommentsInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  mediaId: string,
  commentIds: string[],
): Promise<ThreadsManageCommentsInboxState> {
  const uniqueIds = [...new Set(commentIds.map((id) => id.trim()).filter(Boolean))];
  const now = new Date().toISOString();

  if (uniqueIds.length === 0) {
    await clearInboundForMedia(admin, organizationId, threadsUserId, [mediaId]);
    const { data: postRow } = await admin
      .from("threads_manage_comments_post_inbox_state")
      .select("last_known_comment_count")
      .eq("organization_id", organizationId)
      .eq("threads_user_id", threadsUserId)
      .eq("media_id", mediaId)
      .maybeSingle();
    await admin.from("threads_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      threads_user_id: threadsUserId,
      media_id: mediaId,
      last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
      is_highlighted: false,
      pinned_at: null,
      updated_at: now,
    }, { onConflict: "organization_id,threads_user_id,media_id" });
    return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
  }

  const rows = uniqueIds.map((commentId) => ({
    organization_id: organizationId,
    threads_user_id: threadsUserId,
    media_id: mediaId,
    comment_id: commentId,
    detected_at: now,
  }));
  const { error } = await admin
    .from("threads_manage_comments_inbound_comments")
    .upsert(rows, { onConflict: "organization_id,threads_user_id,media_id,comment_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  await admin.from("threads_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    threads_user_id: threadsUserId,
    media_id: mediaId,
    is_highlighted: true,
    pinned_at: now,
    updated_at: now,
  }, { onConflict: "organization_id,threads_user_id,media_id" });

  return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
}

export async function dismissThreadsManageCommentsPostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  mediaId: string,
): Promise<ThreadsManageCommentsInboxState> {
  const now = new Date().toISOString();
  const { data: postRow } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .select("last_known_comment_count")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId)
    .maybeSingle();

  await admin.from("threads_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    threads_user_id: threadsUserId,
    media_id: mediaId,
    last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
    is_highlighted: false,
    pinned_at: null,
    updated_at: now,
  }, { onConflict: "organization_id,threads_user_id,media_id" });

  return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
}

export async function markThreadsManageCommentsCommentRead(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  mediaId: string,
  commentId: string,
  userId: string,
): Promise<ThreadsManageCommentsInboxState> {
  const now = new Date().toISOString();
  await admin.from("threads_manage_comments_comment_engagements").upsert({
    organization_id: organizationId,
    threads_user_id: threadsUserId,
    media_id: mediaId,
    comment_id: commentId,
    engaged_by: userId,
    engaged_at: now,
  }, { onConflict: "organization_id,threads_user_id,media_id,comment_id" });

  await admin
    .from("threads_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId)
    .eq("comment_id", commentId);

  return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
}
