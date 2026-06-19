import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type LinkedInInboxPostStateRow = {
  post_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type LinkedInInboxInboundCommentRow = {
  post_id: string;
  comment_id: string;
  detected_at: string;
};

export type LinkedInManageCommentsInboxState = {
  posts: LinkedInInboxPostStateRow[];
  inbound_comments: LinkedInInboxInboundCommentRow[];
  engaged_comment_ids: string[];
};

type PostBaselineInput = { post_id: string; comment_count: number };

export async function getLinkedInManageCommentsInboxState(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
): Promise<LinkedInManageCommentsInboxState> {
  const [postsRes, inboundRes, engagedRes] = await Promise.all([
    admin.from("linkedin_manage_comments_post_inbox_state").select("*")
      .eq("organization_id", organizationId).eq("page_id", pageId),
    admin.from("linkedin_manage_comments_inbound_comments").select("*")
      .eq("organization_id", organizationId).eq("page_id", pageId),
    admin.from("linkedin_manage_comments_comment_engagements").select("comment_id")
      .eq("organization_id", organizationId).eq("page_id", pageId),
  ]);
  if (postsRes.error) throw new Error(postsRes.error.message);
  if (inboundRes.error) throw new Error(inboundRes.error.message);
  if (engagedRes.error) throw new Error(engagedRes.error.message);

  return {
    posts: (postsRes.data ?? []).map((row) => ({
      post_id: String(row.post_id),
      last_known_comment_count: Number(row.last_known_comment_count ?? 0),
      is_highlighted: Boolean(row.is_highlighted),
      pinned_at: row.pinned_at ?? null,
    })),
    inbound_comments: (inboundRes.data ?? []).map((row) => ({
      post_id: String(row.post_id),
      comment_id: String(row.comment_id),
      detected_at: String(row.detected_at),
    })),
    engaged_comment_ids: (engagedRes.data ?? []).map((row) => String(row.comment_id)),
  };
}

async function clearInboundForPosts(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  postIds: string[],
): Promise<void> {
  if (postIds.length === 0) return;
  const { error } = await admin
    .from("linkedin_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .in("post_id", postIds);
  if (error) throw new Error(error.message);
}

export async function syncLinkedInManageCommentsPostBaselines(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  posts: PostBaselineInput[],
): Promise<LinkedInManageCommentsInboxState> {
  if (posts.length === 0) {
    return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
  }

  const postIds = posts.map((p) => p.post_id);
  const { data: existingRows, error: fetchErr } = await admin
    .from("linkedin_manage_comments_post_inbox_state")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .in("post_id", postIds);
  if (fetchErr) throw new Error(fetchErr.message);

  const existingByPost = new Map((existingRows ?? []).map((row) => [String(row.post_id), row]));
  const now = new Date().toISOString();

  const upserts = posts.map((post) => {
    const prev = existingByPost.get(post.post_id);
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
      page_id: pageId,
      post_id: post.post_id,
      last_known_comment_count: post.comment_count,
      is_highlighted: isHighlighted,
      pinned_at: pinnedAt,
      updated_at: now,
    };
  });

  const { error: upsertErr } = await admin
    .from("linkedin_manage_comments_post_inbox_state")
    .upsert(upserts, { onConflict: "organization_id,page_id,post_id" });
  if (upsertErr) throw new Error(upsertErr.message);

  await clearInboundForPosts(
    admin,
    organizationId,
    pageId,
    posts.filter((p) => p.comment_count === 0).map((p) => p.post_id),
  );

  return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
}

export async function syncLinkedInManageCommentsInboundComments(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  postId: string,
  commentIds: string[],
): Promise<LinkedInManageCommentsInboxState> {
  const uniqueIds = [...new Set(commentIds.map((id) => id.trim()).filter(Boolean))];
  const now = new Date().toISOString();

  if (uniqueIds.length === 0) {
    await clearInboundForPosts(admin, organizationId, pageId, [postId]);
    const { data: postRow } = await admin
      .from("linkedin_manage_comments_post_inbox_state")
      .select("last_known_comment_count")
      .eq("organization_id", organizationId)
      .eq("page_id", pageId)
      .eq("post_id", postId)
      .maybeSingle();
    await admin.from("linkedin_manage_comments_post_inbox_state").upsert({
      organization_id: organizationId,
      page_id: pageId,
      post_id: postId,
      last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
      is_highlighted: false,
      pinned_at: null,
      updated_at: now,
    }, { onConflict: "organization_id,page_id,post_id" });
    return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
  }

  const rows = uniqueIds.map((commentId) => ({
    organization_id: organizationId,
    page_id: pageId,
    post_id: postId,
    comment_id: commentId,
    detected_at: now,
  }));
  const { error } = await admin
    .from("linkedin_manage_comments_inbound_comments")
    .upsert(rows, { onConflict: "organization_id,page_id,post_id,comment_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  await admin.from("linkedin_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    page_id: pageId,
    post_id: postId,
    is_highlighted: true,
    pinned_at: now,
    updated_at: now,
  }, { onConflict: "organization_id,page_id,post_id" });

  return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
}

export async function dismissLinkedInManageCommentsPostHighlight(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  postId: string,
): Promise<LinkedInManageCommentsInboxState> {
  const now = new Date().toISOString();
  const { data: postRow } = await admin
    .from("linkedin_manage_comments_post_inbox_state")
    .select("last_known_comment_count")
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .eq("post_id", postId)
    .maybeSingle();

  await admin.from("linkedin_manage_comments_post_inbox_state").upsert({
    organization_id: organizationId,
    page_id: pageId,
    post_id: postId,
    last_known_comment_count: Number(postRow?.last_known_comment_count ?? 0),
    is_highlighted: false,
    pinned_at: null,
    updated_at: now,
  }, { onConflict: "organization_id,page_id,post_id" });

  return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
}

export async function markLinkedInManageCommentsCommentRead(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  postId: string,
  commentId: string,
  userId: string,
): Promise<LinkedInManageCommentsInboxState> {
  const now = new Date().toISOString();
  await admin.from("linkedin_manage_comments_comment_engagements").upsert({
    organization_id: organizationId,
    page_id: pageId,
    post_id: postId,
    comment_id: commentId,
    engaged_by: userId,
    engaged_at: now,
  }, { onConflict: "organization_id,page_id,post_id,comment_id" });

  await admin
    .from("linkedin_manage_comments_inbound_comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .eq("post_id", postId)
    .eq("comment_id", commentId);

  return getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
}
