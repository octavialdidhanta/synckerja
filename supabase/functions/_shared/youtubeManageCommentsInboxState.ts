import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type InboxPostStateRow = {
  video_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type InboxInboundCommentRow = {
  video_id: string;
  comment_id: string;
  detected_at: string;
};

export type ManageCommentsInboxState = {
  posts: InboxPostStateRow[];
  inbound_comments: InboxInboundCommentRow[];
  engaged_comment_ids: string[];
};

type PostBaselineInput = {
  video_id: string;
  comment_count: number;
};

export async function getYouTubeManageCommentsInboxState(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
): Promise<ManageCommentsInboxState> {
  const [postsRes, inboundRes, engagedRes] = await Promise.all([
    admin
      .from("youtube_manage_comments_post_inbox_state")
      .select("video_id, last_known_comment_count, is_highlighted, pinned_at, thread_comments_seeded")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId),
    admin
      .from("youtube_manage_comments_inbound_comments")
      .select("video_id, comment_id, detected_at")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId),
    admin
      .from("youtube_manage_comments_comment_engagements")
      .select("comment_id")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId),
  ]);

  if (postsRes.error) throw new Error(postsRes.error.message);
  if (inboundRes.error) throw new Error(inboundRes.error.message);
  if (engagedRes.error) throw new Error(engagedRes.error.message);

  return {
    posts: (postsRes.data ?? []).map((row) => ({
      video_id: String(row.video_id),
      last_known_comment_count: Number(row.last_known_comment_count ?? 0),
      is_highlighted: Boolean(row.is_highlighted),
      pinned_at: row.pinned_at ?? null,
    })),
    inbound_comments: (inboundRes.data ?? []).map((row) => ({
      video_id: String(row.video_id),
      comment_id: String(row.comment_id),
      detected_at: String(row.detected_at),
    })),
    engaged_comment_ids: (engagedRes.data ?? []).map((row) => String(row.comment_id)),
  };
}

async function hasUnengagedInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoId: string,
): Promise<boolean> {
  const [{ data: inbound }, { data: engaged }] = await Promise.all([
    admin
      .from("youtube_manage_comments_inbound_comments")
      .select("comment_id")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId)
      .eq("video_id", videoId),
    admin
      .from("youtube_manage_comments_comment_engagements")
      .select("comment_id")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId)
      .eq("video_id", videoId),
  ]);

  const engagedSet = new Set((engaged ?? []).map((r) => String(r.comment_id)));
  return (inbound ?? []).some((r) => !engagedSet.has(String(r.comment_id)));
}

async function clearInboundForVideos(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoIds: string[],
): Promise<void> {
  if (videoIds.length === 0) return;
  const { error } = await admin
    .from("youtube_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .in("video_id", videoIds);
  if (error) throw new Error(error.message);
}

async function reconcilePostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoId: string,
  lastKnownCommentCount: number,
): Promise<void> {
  const hasUnengaged = await hasUnengagedInboundComments(
    admin,
    organizationId,
    channelId,
    videoId,
  );
  const shouldHighlight = hasUnengaged && lastKnownCommentCount > 0;
  const now = new Date().toISOString();

  const { data: postRow } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .select("pinned_at, thread_comments_seeded")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", videoId)
    .maybeSingle();

  await admin
    .from("youtube_manage_comments_post_inbox_state")
    .upsert({
      organization_id: organizationId,
      channel_id: channelId,
      video_id: videoId,
      last_known_comment_count: lastKnownCommentCount,
      is_highlighted: shouldHighlight,
      pinned_at: shouldHighlight ? (postRow?.pinned_at ?? now) : null,
      thread_comments_seeded: Boolean(postRow?.thread_comments_seeded),
      updated_at: now,
    }, { onConflict: "organization_id,channel_id,video_id" });
}

export async function dismissYouTubeManageCommentsPostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoId: string,
): Promise<ManageCommentsInboxState> {
  const trimmedVideoId = videoId.trim();
  if (!trimmedVideoId) throw new Error("Missing video_id");

  const now = new Date().toISOString();
  const { data: postRow } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .select("last_known_comment_count, thread_comments_seeded")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", trimmedVideoId)
    .maybeSingle();

  await admin
    .from("youtube_manage_comments_post_inbox_state")
    .upsert({
      organization_id: organizationId,
      channel_id: channelId,
      video_id: trimmedVideoId,
      last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
      is_highlighted: false,
      pinned_at: null,
      thread_comments_seeded: Boolean(postRow?.thread_comments_seeded),
      updated_at: now,
    }, { onConflict: "organization_id,channel_id,video_id" });

  return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
}

export async function syncYouTubeManageCommentsPostBaselines(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  posts: PostBaselineInput[],
): Promise<ManageCommentsInboxState> {
  if (posts.length === 0) {
    return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
  }

  const videoIds = posts.map((p) => p.video_id);
  const { data: existingRows, error: fetchErr } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .select("video_id, last_known_comment_count, is_highlighted, pinned_at, thread_comments_seeded")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .in("video_id", videoIds);

  if (fetchErr) throw new Error(fetchErr.message);

  const existingByVideo = new Map(
    (existingRows ?? []).map((row) => [String(row.video_id), row]),
  );

  const now = new Date().toISOString();
  const upserts = posts.map((post) => {
    const prev = existingByVideo.get(post.video_id);
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
      channel_id: channelId,
      video_id: post.video_id,
      last_known_comment_count: post.comment_count,
      is_highlighted: isHighlighted,
      thread_comments_seeded: Boolean(prev?.thread_comments_seeded),
      pinned_at: pinnedAt,
      updated_at: now,
    };
  });

  const { error: upsertErr } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .upsert(upserts, { onConflict: "organization_id,channel_id,video_id" });

  if (upsertErr) throw new Error(upsertErr.message);

  const zeroCommentVideoIds = posts
    .filter((post) => post.comment_count === 0)
    .map((post) => post.video_id);
  await clearInboundForVideos(admin, organizationId, channelId, zeroCommentVideoIds);

  return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
}

export async function syncYouTubeManageCommentsInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoId: string,
  commentIds: string[],
): Promise<ManageCommentsInboxState> {
  const uniqueIds = [...new Set(commentIds.map((id) => id.trim()).filter(Boolean))];
  const now = new Date().toISOString();
  const { data: postRow, error: postErr } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .select("thread_comments_seeded, is_highlighted, last_known_comment_count, pinned_at")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", videoId)
    .maybeSingle();

  if (postErr) throw new Error(postErr.message);

  const lastKnownCount = Number(postRow?.last_known_comment_count ?? 0);

  if (uniqueIds.length === 0) {
    await clearInboundForVideos(admin, organizationId, channelId, [videoId]);
    await admin
      .from("youtube_manage_comments_post_inbox_state")
      .upsert({
        organization_id: organizationId,
        channel_id: channelId,
        video_id: videoId,
        last_known_comment_count: lastKnownCount,
        is_highlighted: false,
        thread_comments_seeded: true,
        pinned_at: null,
        updated_at: now,
      }, { onConflict: "organization_id,channel_id,video_id" });
    return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
  }

  const threadSeeded = Boolean(postRow?.thread_comments_seeded);

  const { data: existingInbound, error: inboundErr } = await admin
    .from("youtube_manage_comments_inbound_comments")
    .select("comment_id")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", videoId);

  if (inboundErr) throw new Error(inboundErr.message);

  const currentIdSet = new Set(uniqueIds);
  const staleInboundIds = (existingInbound ?? [])
    .map((r) => String(r.comment_id))
    .filter((id) => !currentIdSet.has(id));
  if (staleInboundIds.length > 0) {
    const { error: staleErr } = await admin
      .from("youtube_manage_comments_inbound_comments")
      .delete()
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId)
      .eq("video_id", videoId)
      .in("comment_id", staleInboundIds);
    if (staleErr) throw new Error(staleErr.message);
  }

  const existingSet = new Set(
    (existingInbound ?? [])
      .map((r) => String(r.comment_id))
      .filter((id) => currentIdSet.has(id)),
  );

  const { data: engagedRows, error: engagedErr } = await admin
    .from("youtube_manage_comments_comment_engagements")
    .select("comment_id")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", videoId);

  if (engagedErr) throw new Error(engagedErr.message);

  const engagedSet = new Set((engagedRows ?? []).map((r) => String(r.comment_id)));

  if (!threadSeeded) {
    const baselineIds = uniqueIds.filter((id) => !engagedSet.has(id));
    if (baselineIds.length > 0) {
      const { error: insertErr } = await admin
        .from("youtube_manage_comments_inbound_comments")
        .upsert(
          baselineIds.map((comment_id) => ({
            organization_id: organizationId,
            channel_id: channelId,
            video_id: videoId,
            comment_id,
            detected_at: now,
          })),
          { onConflict: "organization_id,channel_id,video_id,comment_id", ignoreDuplicates: true },
        );
      if (insertErr) throw new Error(insertErr.message);
    }

    await admin
      .from("youtube_manage_comments_post_inbox_state")
      .upsert({
        organization_id: organizationId,
        channel_id: channelId,
        video_id: videoId,
        last_known_comment_count: lastKnownCount,
        is_highlighted: false,
        thread_comments_seeded: true,
        pinned_at: null,
        updated_at: now,
      }, { onConflict: "organization_id,channel_id,video_id" });

    return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
  }

  const freshIds = uniqueIds.filter((id) => !existingSet.has(id) && !engagedSet.has(id));
  if (freshIds.length > 0) {
    const { error: insertErr } = await admin
      .from("youtube_manage_comments_inbound_comments")
      .upsert(
        freshIds.map((comment_id) => ({
          organization_id: organizationId,
          channel_id: channelId,
          video_id: videoId,
          comment_id,
          detected_at: now,
        })),
        { onConflict: "organization_id,channel_id,video_id,comment_id", ignoreDuplicates: true },
      );
    if (insertErr) throw new Error(insertErr.message);

    await admin
      .from("youtube_manage_comments_post_inbox_state")
      .upsert({
        organization_id: organizationId,
        channel_id: channelId,
        video_id: videoId,
        last_known_comment_count: lastKnownCount,
        is_highlighted: true,
        thread_comments_seeded: true,
        pinned_at: now,
        updated_at: now,
      }, { onConflict: "organization_id,channel_id,video_id" });
  } else {
    await reconcilePostHighlight(admin, organizationId, channelId, videoId, lastKnownCount);
  }

  return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
}

export async function markYouTubeManageCommentsCommentRead(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
  videoId: string,
  commentId: string,
  engagedBy: string | null,
): Promise<ManageCommentsInboxState> {
  const trimmedCommentId = commentId.trim();
  const trimmedVideoId = videoId.trim();
  if (!trimmedCommentId || !trimmedVideoId) {
    throw new Error("Missing video_id or comment_id");
  }

  const now = new Date().toISOString();

  const { error: engageErr } = await admin
    .from("youtube_manage_comments_comment_engagements")
    .upsert({
      organization_id: organizationId,
      channel_id: channelId,
      video_id: trimmedVideoId,
      comment_id: trimmedCommentId,
      engagement_type: "read",
      engaged_by: engagedBy,
      engaged_at: now,
    }, { onConflict: "organization_id,channel_id,video_id,comment_id" });

  if (engageErr) throw new Error(engageErr.message);

  const { data: postRow } = await admin
    .from("youtube_manage_comments_post_inbox_state")
    .select("last_known_comment_count")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .eq("video_id", trimmedVideoId)
    .maybeSingle();

  await reconcilePostHighlight(
    admin,
    organizationId,
    channelId,
    trimmedVideoId,
    Number(postRow?.last_known_comment_count ?? 0),
  );

  return getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
}
