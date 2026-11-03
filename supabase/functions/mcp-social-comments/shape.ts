// Pure shaping for mcp-social-comments. No Deno or network imports, so the MCP
// service tests can load it with Node.

export const COMMENT_PLATFORMS = ["instagram", "facebook", "threads", "tiktok", "youtube", "linkedin"] as const;
export type CommentPlatform = (typeof COMMENT_PLATFORMS)[number];

export const MAX_ACCOUNTS_PER_PLATFORM = 3;
export const DEFAULT_POSTS_PER_ACCOUNT = 12;
export const MAX_POSTS_PER_ACCOUNT = 25;
export const MAX_COMMENTS_RETURNED = 300;
export const TEXT_LIMIT = 1000;
export const CAPTION_LIMIT = 120;

/** One comment or reply as a platform adapter reads it. */
export type RawComment = {
  id: string;
  parentId: string | null;
  text: string | null;
  author: string | null;
  publishedAt: string | null;
  likeCount: number | null;
  replyCount: number;
  /** Written by the connected account itself (page, channel, profile). */
  isOwner: boolean;
};

export type PostRef = {
  id: string;
  caption: string | null;
  url: string | null;
  publishedAt: string | null;
  isAd: boolean;
  commentCount: number | null;
};

export type SocialComment = {
  platform: CommentPlatform;
  account_label: string;
  post_id: string;
  post_caption: string | null;
  post_url: string | null;
  post_published_at: string | null;
  post_is_ad: boolean;
  comment_id: string;
  author: string | null;
  text: string;
  published_at: string | null;
  like_count: number | null;
  reply_count: number;
  /** true: the account replied. false: no reply. null: replies exist but could not be read. */
  replied_by_account: boolean | null;
  /** Marked read, liked, or replied by a team member inside Synckerja. */
  handled_in_synckerja: boolean;
};

export type AccountStatus = {
  platform: CommentPlatform;
  account_label: string | null;
  status: "ok" | "not_connected" | "error";
  error: string | null;
  posts_scanned: number;
  comments_in_period: number;
  partial: boolean;
};

export function clip(value: string | null | undefined, limit: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function timeMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Jakarta calendar days, end inclusive, as UTC milliseconds [from, to). */
export function jakartaBounds(startYmd: string, endYmd: string): { fromMs: number; toMs: number } {
  const fromMs = Date.parse(`${startYmd}T00:00:00+07:00`);
  const toMs = Date.parse(`${endYmd}T00:00:00+07:00`) + 86_400_000;
  return { fromMs, toMs };
}

export function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Newest posts first, without posts published after the period, at most `limit`. */
export function pickPosts(posts: PostRef[], toMs: number, limit: number): PostRef[] {
  return posts
    .filter((post) => post.id && post.commentCount !== 0)
    .filter((post) => {
      const at = timeMs(post.publishedAt);
      return at == null || at < toMs;
    })
    .sort((a, b) => (timeMs(b.publishedAt) ?? 0) - (timeMs(a.publishedAt) ?? 0))
    .slice(0, limit);
}

function repliedByAccount(row: RawComment, children: RawComment[], repliedInSynckerja: Set<string>): boolean | null {
  if (children.some((child) => child.isOwner) || repliedInSynckerja.has(row.id)) return true;
  if (row.replyCount <= 0 && children.length === 0) return false;
  if (children.length > 0 && children.length >= row.replyCount) return false;
  return null;
}

/**
 * Top-level customer comments on one post, published inside [fromMs, toMs).
 * Comments by the account itself are left out. Threads replies point at the post id
 * as parent, so a parent equal to the post counts as top level.
 */
export function shapePostComments(args: {
  platform: CommentPlatform;
  accountLabel: string;
  post: PostRef;
  rows: RawComment[];
  fromMs: number;
  toMs: number;
  handled: Set<string>;
  repliedInSynckerja: Set<string>;
}): SocialComment[] {
  const { platform, accountLabel, post, rows, fromMs, toMs, handled, repliedInSynckerja } = args;
  const children = new Map<string, RawComment[]>();
  for (const row of rows) {
    if (!row.parentId || row.parentId === post.id) continue;
    const list = children.get(row.parentId) ?? [];
    list.push(row);
    children.set(row.parentId, list);
  }
  const out: SocialComment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    if (row.parentId && row.parentId !== post.id) continue;
    if (row.isOwner) continue;
    const at = timeMs(row.publishedAt);
    if (at == null || at < fromMs || at >= toMs) continue;
    seen.add(row.id);
    const kids = children.get(row.id) ?? [];
    out.push({
      platform,
      account_label: accountLabel,
      post_id: post.id,
      post_caption: clip(post.caption, CAPTION_LIMIT),
      post_url: post.url,
      post_published_at: post.publishedAt,
      post_is_ad: post.isAd,
      comment_id: row.id,
      author: clip(row.author, 80),
      text: clip(row.text, TEXT_LIMIT) ?? "",
      published_at: row.publishedAt,
      like_count: row.likeCount,
      reply_count: Math.max(row.replyCount, kids.length),
      replied_by_account: repliedByAccount(row, kids, repliedInSynckerja),
      handled_in_synckerja: handled.has(row.id) || repliedInSynckerja.has(row.id),
    });
  }
  return out;
}

export function newestFirst(comments: SocialComment[]): SocialComment[] {
  return [...comments].sort((a, b) => (timeMs(b.published_at) ?? 0) - (timeMs(a.published_at) ?? 0));
}

/** Error text safe to show: no tokens, no long upstream dumps. */
export function publicError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "request_failed";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || /token|secret|bearer|authorization|access_token/i.test(text)) return "request_failed";
  return text.slice(0, 180);
}

/** Runs tasks with a concurrency cap; stops starting new ones after the deadline. */
export async function runLimited<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  deadlineMs: number,
  now: () => number = Date.now,
): Promise<{ results: T[]; skipped: number }> {
  const results: T[] = [];
  let index = 0;
  let skipped = 0;
  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index];
      index += 1;
      if (now() >= deadlineMs) {
        skipped += 1;
        continue;
      }
      results.push(await task());
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, worker));
  return { results, skipped };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
