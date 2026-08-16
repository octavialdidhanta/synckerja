type PostHighlightBucket = {
  highlightedPostIds: Set<string>;
  pinnedPostIds: Set<string>;
  pinnedAtMs: Map<string, number>;
  commentCountsByPostId: Map<string, number>;
  seeded: boolean;
};

type CommentHighlightBucket = {
  seenCommentIds: Set<string>;
  highlightedCommentIds: Set<string>;
  pinnedCommentIds: Set<string>;
  pendingEngagedCommentIds: Set<string>;
  seeded: boolean;
};

const postBuckets = new Map<string, PostHighlightBucket>();
const commentBuckets = new Map<string, CommentHighlightBucket>();

let storeVersion = 0;
const listeners = new Set<() => void>();

const postViewCache = new Map<string, { version: number; view: PostHighlightStoreView }>();
const commentViewCache = new Map<string, { version: number; view: CommentHighlightStoreView }>();

function notify() {
  storeVersion += 1;
  postViewCache.clear();
  commentViewCache.clear();
  for (const listener of listeners) listener();
}

export function subscribeManageCommentsInboundHighlights(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getManageCommentsInboundHighlightsVersion(): number {
  return storeVersion;
}

function getOrCreatePostBucket(openId: string): PostHighlightBucket {
  let bucket = postBuckets.get(openId);
  if (!bucket) {
    bucket = {
      highlightedPostIds: new Set(),
      pinnedPostIds: new Set(),
      pinnedAtMs: new Map(),
      commentCountsByPostId: new Map(),
      seeded: false,
    };
    postBuckets.set(openId, bucket);
  }
  return bucket;
}

function commentBucketKey(openId: string, videoId: string): string {
  return `${openId}:${videoId}`;
}

function getOrCreateCommentBucket(openId: string, videoId: string): CommentHighlightBucket {
  const key = commentBucketKey(openId, videoId);
  let bucket = commentBuckets.get(key);
  if (!bucket) {
    bucket = {
      seenCommentIds: new Set(),
      highlightedCommentIds: new Set(),
      pinnedCommentIds: new Set(),
      pendingEngagedCommentIds: new Set(),
      seeded: false,
    };
    commentBuckets.set(key, bucket);
  }
  return bucket;
}

export type PostHighlightStoreView = {
  highlightedPostIds: Set<string>;
  pinnedPostIds: Set<string>;
  pinnedAtMs: Map<string, number>;
  seeded: boolean;
  version: number;
};

export function getPostHighlightStoreView(openId: string): PostHighlightStoreView {
  const cached = postViewCache.get(openId);
  if (cached && cached.version === storeVersion) {
    return cached.view;
  }

  const bucket = getOrCreatePostBucket(openId);
  const view: PostHighlightStoreView = {
    highlightedPostIds: bucket.highlightedPostIds,
    pinnedPostIds: bucket.pinnedPostIds,
    pinnedAtMs: bucket.pinnedAtMs,
    seeded: bucket.seeded,
    version: storeVersion,
  };
  postViewCache.set(openId, { version: storeVersion, view });
  return view;
}

export function isPostHighlightStoreSeeded(openId: string): boolean {
  return getOrCreatePostBucket(openId).seeded;
}

export function seedPostCommentCounts(
  openId: string,
  posts: Array<{ id: string; commentCount: number }>,
): void {
  const bucket = getOrCreatePostBucket(openId);
  if (bucket.seeded) return;
  for (const post of posts) {
    bucket.commentCountsByPostId.set(post.id, post.commentCount);
  }
  bucket.seeded = true;
  notify();
}

export function syncPostCommentCountChanges(
  openId: string,
  posts: Array<{ id: string; commentCount: number }>,
  selectedPostId: string | null,
): void {
  const bucket = getOrCreatePostBucket(openId);
  if (!bucket.seeded) return;

  let changed = false;
  for (const post of posts) {
    const prev = bucket.commentCountsByPostId.get(post.id);
    if (post.commentCount === 0) {
      if (bucket.highlightedPostIds.delete(post.id)) changed = true;
      if (bucket.pinnedPostIds.delete(post.id)) changed = true;
      bucket.pinnedAtMs.delete(post.id);
    } else if (prev != null && post.commentCount > prev) {
      bucket.pinnedAtMs.set(post.id, Date.now());
      bucket.pinnedPostIds.add(post.id);
      if (post.id !== selectedPostId) {
        bucket.highlightedPostIds.add(post.id);
      }
      changed = true;
    }
    bucket.commentCountsByPostId.set(post.id, post.commentCount);
  }
  if (changed) notify();
}

export function bumpPostInboundHighlight(
  openId: string,
  postId: string,
  highlight: boolean,
): void {
  if (!postId) return;
  const bucket = getOrCreatePostBucket(openId);
  const alreadyPinned = bucket.pinnedPostIds.has(postId);
  const alreadyHighlighted = bucket.highlightedPostIds.has(postId);
  if (alreadyPinned && (!highlight || alreadyHighlighted)) return;

  if (!alreadyPinned) {
    bucket.pinnedAtMs.set(postId, Date.now());
    bucket.pinnedPostIds.add(postId);
  }
  if (highlight) bucket.highlightedPostIds.add(postId);
  notify();
}

export function dismissPostInboundHighlight(openId: string, postId: string): void {
  if (!postId) return;
  const bucket = getOrCreatePostBucket(openId);
  if (!bucket.highlightedPostIds.delete(postId)) return;
  notify();
}

export type CommentHighlightStoreView = {
  highlightedCommentIds: Set<string>;
  pinnedCommentIds: Set<string>;
  seeded: boolean;
  version: number;
};

export function getCommentHighlightStoreView(
  openId: string,
  videoId: string,
): CommentHighlightStoreView {
  const key = commentBucketKey(openId, videoId);
  const cached = commentViewCache.get(key);
  if (cached && cached.version === storeVersion) {
    return cached.view;
  }

  const bucket = getOrCreateCommentBucket(openId, videoId);
  const view: CommentHighlightStoreView = {
    highlightedCommentIds: bucket.highlightedCommentIds,
    pinnedCommentIds: bucket.pinnedCommentIds,
    seeded: bucket.seeded,
    version: storeVersion,
  };
  commentViewCache.set(key, { version: storeVersion, view });
  return view;
}

export function isCommentHighlightStoreSeeded(openId: string, videoId: string): boolean {
  return getOrCreateCommentBucket(openId, videoId).seeded;
}

export function seedCommentIds(
  openId: string,
  videoId: string,
  commentIds: string[],
): void {
  const bucket = getOrCreateCommentBucket(openId, videoId);
  if (bucket.seeded) return;
  for (const id of commentIds) {
    if (id) bucket.seenCommentIds.add(id);
  }
  bucket.seeded = true;
  notify();
}

export function syncFreshCommentIds(
  openId: string,
  videoId: string,
  commentIds: string[],
): string[] {
  const bucket = getOrCreateCommentBucket(openId, videoId);
  if (!bucket.seeded) return [];

  const fresh = commentIds.filter((id) => id && !bucket.seenCommentIds.has(id));
  if (fresh.length === 0) return fresh;

  for (const id of fresh) bucket.seenCommentIds.add(id);
  for (const id of fresh) {
    bucket.pinnedCommentIds.add(id);
    bucket.highlightedCommentIds.add(id);
  }
  notify();
  return fresh;
}

export function dismissCommentInboundHighlight(
  openId: string,
  videoId: string,
  commentId: string,
): void {
  if (!commentId) return;
  const bucket = getOrCreateCommentBucket(openId, videoId);
  bucket.pendingEngagedCommentIds.add(commentId);
  if (!bucket.highlightedCommentIds.delete(commentId)) return;
  notify();
}

/** Remove comment from pin/highlight state after hide or delete. */
export function removeCommentFromHighlightStore(
  openId: string,
  videoId: string,
  commentId: string,
): void {
  if (!commentId) return;
  const bucket = getOrCreateCommentBucket(openId, videoId);
  bucket.seenCommentIds.delete(commentId);
  const hadHighlight = bucket.highlightedCommentIds.delete(commentId);
  const hadPin = bucket.pinnedCommentIds.delete(commentId);
  if (!hadHighlight && !hadPin) return;
  notify();
}

/** Replace in-memory bucket from server snapshot (org-level shared inbox). */
export function hydratePostHighlightStoreFromServer(
  openId: string,
  posts: Array<{
    video_id: string;
    is_highlighted: boolean;
    pinned_at: string | null;
    last_known_comment_count: number;
  }>,
): void {
  const bucket = getOrCreatePostBucket(openId);
  const nextHighlighted = new Set<string>();
  const nextPinned = new Set<string>();
  const nextPinnedAt = new Map<string, number>();
  const nextCounts = new Map<string, number>();

  for (const row of posts) {
    nextCounts.set(row.video_id, row.last_known_comment_count);
    const hasComments = row.last_known_comment_count > 0;
    if (row.pinned_at && hasComments) {
      nextPinned.add(row.video_id);
      const ms = new Date(row.pinned_at).getTime();
      if (Number.isFinite(ms)) nextPinnedAt.set(row.video_id, ms);
    }
    if (row.is_highlighted && hasComments) nextHighlighted.add(row.video_id);
  }

  const same =
    bucket.seeded &&
    setsEqual(bucket.highlightedPostIds, nextHighlighted) &&
    setsEqual(bucket.pinnedPostIds, nextPinned) &&
    mapsEqual(bucket.pinnedAtMs, nextPinnedAt) &&
    mapsEqual(bucket.commentCountsByPostId, nextCounts);
  if (same) return;

  bucket.highlightedPostIds = nextHighlighted;
  bucket.pinnedPostIds = nextPinned;
  bucket.pinnedAtMs = nextPinnedAt;
  bucket.commentCountsByPostId = nextCounts;
  bucket.seeded = true;
  notify();
}

export function hydrateCommentHighlightStoreFromServer(
  openId: string,
  videoId: string,
  inboundCommentIds: string[],
  engagedCommentIds: Set<string>,
): void {
  const bucket = getOrCreateCommentBucket(openId, videoId);
  const nextSeen = new Set<string>();
  const nextPinned = new Set<string>();
  const nextHighlighted = new Set<string>();

  for (const id of inboundCommentIds) {
    if (!id) continue;
    nextSeen.add(id);
    nextPinned.add(id);
    if (engagedCommentIds.has(id)) {
      bucket.pendingEngagedCommentIds.delete(id);
      continue;
    }
    if (bucket.pendingEngagedCommentIds.has(id)) continue;
    nextHighlighted.add(id);
  }

  const same =
    bucket.seeded &&
    setsEqual(bucket.seenCommentIds, nextSeen) &&
    setsEqual(bucket.pinnedCommentIds, nextPinned) &&
    setsEqual(bucket.highlightedCommentIds, nextHighlighted);
  if (same) return;

  bucket.seenCommentIds = nextSeen;
  bucket.pinnedCommentIds = nextPinned;
  bucket.highlightedCommentIds = nextHighlighted;
  bucket.seeded = true;
  notify();
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}
