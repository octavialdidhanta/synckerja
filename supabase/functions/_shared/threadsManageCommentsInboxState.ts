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

async function hasUnengagedThreadsInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  mediaId: string,
): Promise<boolean> {
  const [{ data: inbound }, { data: engaged }] = await Promise.all([
    admin
      .from("threads_manage_comments_inbound_comments")
      .select("comment_id")
      .eq("organization_id", organizationId)
      .eq("threads_user_id", threadsUserId)
      .eq("media_id", mediaId),
    admin
      .from("threads_manage_comments_comment_engagements")
      .select("comment_id")
      .eq("organization_id", organizationId)
      .eq("threads_user_id", threadsUserId)
      .eq("media_id", mediaId),
  ]);

  const engagedSet = new Set((engaged ?? []).map((r) => String(r.comment_id)));
  return (inbound ?? []).some((r) => !engagedSet.has(String(r.comment_id)));
}

async function reconcileThreadsPostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
  mediaId: string,
  lastKnownCommentCount: number,
): Promise<void> {
  const hasUnengaged = await hasUnengagedThreadsInboundComments(
    admin,
    organizationId,
    threadsUserId,
    mediaId,
  );
  const shouldHighlight = hasUnengaged && lastKnownCommentCount > 0;
  const now = new Date().toISOString();

  const { data: postRow } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .select("pinned_at")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId)
    .maybeSingle();

  await admin.from("threads_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    threads_user_id: threadsUserId,
    media_id: mediaId,
    last_known_comment_count: lastKnownCommentCount,
    is_highlighted: shouldHighlight,
    pinned_at: shouldHighlight ? (postRow?.pinned_at ?? now) : null,
    updated_at: now,
  }, { onConflict: "organization_id,threads_user_id,media_id" });
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

  const { data: postRow, error: postErr } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .select("last_known_comment_count, is_highlighted, pinned_at")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (postErr) throw new Error(postErr.message);

  const lastKnownCount = Number(postRow?.last_known_comment_count ?? 0);

  if (uniqueIds.length === 0) {
    await clearInboundForMedia(admin, organizationId, threadsUserId, [mediaId]);
    await admin.from("threads_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      threads_user_id: threadsUserId,
      media_id: mediaId,
      last_known_comment_count: lastKnownCount,
      is_highlighted: false,
      pinned_at: null,
      updated_at: now,
    }, { onConflict: "organization_id,threads_user_id,media_id" });
    return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
  }

  const { data: existingInbound, error: inboundErr } = await admin
    .from("threads_manage_comments_inbound_comments")
    .select("comment_id")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId);
  if (inboundErr) throw new Error(inboundErr.message);

  const currentIdSet = new Set(uniqueIds);
  const staleInboundIds = (existingInbound ?? [])
    .map((r) => String(r.comment_id))
    .filter((id) => !currentIdSet.has(id));
  if (staleInboundIds.length > 0) {
    const { error: staleErr } = await admin
      .from("threads_manage_comments_inbound_comments")
      .delete()
      .eq("organization_id", organizationId)
      .eq("threads_user_id", threadsUserId)
      .eq("media_id", mediaId)
      .in("comment_id", staleInboundIds);
    if (staleErr) throw new Error(staleErr.message);
  }

  const existingSet = new Set(
    (existingInbound ?? [])
      .map((r) => String(r.comment_id))
      .filter((id) => currentIdSet.has(id)),
  );

  const { data: engagedRows, error: engagedErr } = await admin
    .from("threads_manage_comments_comment_engagements")
    .select("comment_id")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId);
  if (engagedErr) throw new Error(engagedErr.message);

  const engagedSet = new Set((engagedRows ?? []).map((r) => String(r.comment_id)));
  const threadSeeded = (existingInbound ?? []).length > 0;

  if (!threadSeeded) {
    const baselineIds = uniqueIds.filter((id) => !engagedSet.has(id));
    if (baselineIds.length > 0) {
      const { error: insertErr } = await admin
        .from("threads_manage_comments_inbound_comments")
        .upsert(
          baselineIds.map((comment_id) => ({
            organization_id: organizationId,
            threads_user_id: threadsUserId,
            media_id: mediaId,
            comment_id,
            detected_at: now,
          })),
          { onConflict: "organization_id,threads_user_id,media_id,comment_id", ignoreDuplicates: true },
        );
      if (insertErr) throw new Error(insertErr.message);
    }

    await admin.from("threads_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      threads_user_id: threadsUserId,
      media_id: mediaId,
      last_known_comment_count: lastKnownCount,
      is_highlighted: false,
      pinned_at: null,
      updated_at: now,
    }, { onConflict: "organization_id,threads_user_id,media_id" });

    return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
  }

  const freshIds = uniqueIds.filter((id) => !existingSet.has(id) && !engagedSet.has(id));
  if (freshIds.length > 0) {
    const { error: insertErr } = await admin
      .from("threads_manage_comments_inbound_comments")
      .upsert(
        freshIds.map((comment_id) => ({
          organization_id: organizationId,
          threads_user_id: threadsUserId,
          media_id: mediaId,
          comment_id,
          detected_at: now,
        })),
        { onConflict: "organization_id,threads_user_id,media_id,comment_id", ignoreDuplicates: true },
      );
    if (insertErr) throw new Error(insertErr.message);

    await admin.from("threads_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      threads_user_id: threadsUserId,
      media_id: mediaId,
      last_known_comment_count: lastKnownCount,
      is_highlighted: true,
      pinned_at: now,
      updated_at: now,
    }, { onConflict: "organization_id,threads_user_id,media_id" });
  } else {
    await reconcileThreadsPostHighlight(
      admin,
      organizationId,
      threadsUserId,
      mediaId,
      lastKnownCount,
    );
  }

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

  const { data: postRow } = await admin
    .from("threads_manage_comments_post_inbox_state")
    .select("last_known_comment_count")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("media_id", mediaId)
    .maybeSingle();

  await reconcileThreadsPostHighlight(
    admin,
    organizationId,
    threadsUserId,
    mediaId,
    Number(postRow?.last_known_comment_count ?? 0),
  );

  return getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
}
