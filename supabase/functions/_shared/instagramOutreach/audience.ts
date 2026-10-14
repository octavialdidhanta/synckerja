export const INSTAGRAM_USERNAME_RE = /^[a-z0-9._]{2,30}$/;

export const OUTREACH_DAILY_COPY_SOFT_CAP = 30;
export const OUTREACH_MAX_MATERIALS = 5;
export const OUTREACH_DISCOVER_COMMENT_CAP = 300;
export const OUTREACH_MEDIA_BUCKET = "instagram-outreach-media";

export type AudienceStatus = "new" | "copied" | "sent" | "replied" | "converted" | "skipped";
export type AudienceSource = "comment" | "manual";
export type ManualKind = "like" | "repost" | "other";

export type ExistingAudienceRow = {
  username: string;
  source: AudienceSource;
  manualKind: ManualKind | null;
  status: AudienceStatus;
  commentText: string | null;
  commentId: string | null;
  mediaPermalink: string | null;
};

export type DiscoveredComment = {
  username: string;
  commentText: string | null;
  commentId: string | null;
  mediaPermalink: string | null;
  commentedAt: string | null;
};

export type RawOutreachComment = {
  id?: string | null;
  text?: string | null;
  username?: string | null;
  timestamp?: string | null;
};

export type RawOutreachMedia = {
  permalink?: string | null;
  like_count?: number | null;
  comments?: { data?: RawOutreachComment[] | null } | RawOutreachComment[] | null;
};

export type MergedAudienceChange = {
  action: "insert" | "update";
  username: string;
  source: AudienceSource;
  manualKind: ManualKind | null;
  status: AudienceStatus;
  commentText: string | null;
  commentId: string | null;
  mediaPermalink: string | null;
};

export function normalizeInstagramUsername(raw: string): string | null {
  const username = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!INSTAGRAM_USERNAME_RE.test(username)) return null;
  return username;
}

export function parseManualUsernames(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw.split(/[\s,;]+/).map((token) => token.trim()).filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    const username = normalizeInstagramUsername(token);
    if (!username) {
      invalid.push(token);
      continue;
    }
    if (seen.has(username)) continue;
    seen.add(username);
    valid.push(username);
  }
  return { valid, invalid };
}

export function interpolateOutreachBody(body: string, username: string): string {
  return body.replaceAll("{username}", `@${username}`);
}

export function jakartaDayStartIso(now: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${day}T00:00:00+07:00`).toISOString();
}

function commentList(
  comments: RawOutreachMedia["comments"],
): RawOutreachComment[] {
  if (!comments) return [];
  if (Array.isArray(comments)) return comments;
  return comments.data ?? [];
}

function preferNewerComment(current: DiscoveredComment | undefined, next: DiscoveredComment): DiscoveredComment {
  if (!current) return next;
  if (!next.commentedAt) return current;
  if (!current.commentedAt) return next;
  return next.commentedAt > current.commentedAt ? next : current;
}

export function collectDiscoveredComments(args: {
  media: RawOutreachMedia[];
  competitorUsername: string;
  maxComments?: number;
}): {
  comments: DiscoveredComment[];
  postsScanned: number;
  commentsSeen: number;
  skippedNoUsername: number;
  likeCountTotal: number;
} {
  const maxComments = args.maxComments ?? OUTREACH_DISCOVER_COMMENT_CAP;
  const competitor = normalizeInstagramUsername(args.competitorUsername);
  const byUsername = new Map<string, DiscoveredComment>();
  let postsScanned = 0;
  let commentsSeen = 0;
  let skippedNoUsername = 0;
  let likeCountTotal = 0;
  let stopped = false;

  for (const media of args.media) {
    if (stopped) break;
    postsScanned += 1;
    if (typeof media.like_count === "number" && Number.isFinite(media.like_count)) {
      likeCountTotal += media.like_count;
    }
    for (const comment of commentList(media.comments)) {
      if (commentsSeen >= maxComments) {
        stopped = true;
        break;
      }
      commentsSeen += 1;
      const username = normalizeInstagramUsername(comment.username ?? "");
      if (!username) {
        skippedNoUsername += 1;
        continue;
      }
      if (competitor && username === competitor) continue;
      const text = comment.text?.trim() ? comment.text.trim() : null;
      byUsername.set(
        username,
        preferNewerComment(byUsername.get(username), {
          username,
          commentText: text,
          commentId: comment.id?.trim() ? comment.id.trim() : null,
          mediaPermalink: media.permalink?.trim() ? media.permalink.trim() : null,
          commentedAt: comment.timestamp?.trim() ? comment.timestamp.trim() : null,
        }),
      );
    }
  }

  return {
    comments: [...byUsername.values()],
    postsScanned,
    commentsSeen,
    skippedNoUsername,
    likeCountTotal,
  };
}

export function mergeDiscoveredComments(
  existing: ExistingAudienceRow[],
  discovered: DiscoveredComment[],
): MergedAudienceChange[] {
  const existingByUsername = new Map(existing.map((row) => [row.username, row]));
  const changes: MergedAudienceChange[] = [];
  for (const comment of discovered) {
    const current = existingByUsername.get(comment.username);
    if (!current) {
      changes.push({
        action: "insert",
        username: comment.username,
        source: "comment",
        manualKind: null,
        status: "new",
        commentText: comment.commentText,
        commentId: comment.commentId,
        mediaPermalink: comment.mediaPermalink,
      });
      continue;
    }
    changes.push({
      action: "update",
      username: current.username,
      source: current.source,
      manualKind: current.manualKind,
      status: current.status,
      commentText: comment.commentText,
      commentId: comment.commentId,
      mediaPermalink: comment.mediaPermalink,
    });
  }
  return changes;
}

export function applyManualPaste(args: {
  existing: ExistingAudienceRow | null;
  username: string;
  manualKind: ManualKind;
}): {
  action: "insert" | "update";
  username: string;
  source: AudienceSource;
  manualKind: ManualKind;
  status: AudienceStatus;
} {
  if (!args.existing) {
    return {
      action: "insert",
      username: args.username,
      source: "manual",
      manualKind: args.manualKind,
      status: "new",
    };
  }
  return {
    action: "update",
    username: args.existing.username,
    source: args.existing.source,
    manualKind: args.manualKind,
    status: args.existing.status,
  };
}
