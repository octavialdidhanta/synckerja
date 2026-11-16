import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import { calendarDay } from "../inputs";

export const linkedinPerformanceInput = z.object({
  page_id: z.string().min(1).max(64).optional(),
  date_start: calendarDay.optional(),
  date_end: calendarDay.optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

export type LinkedInPerformanceQuery = {
  pageId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  limit: number;
};

export type LinkedInPerformancePost = {
  post_id: string;
  title: string;
  share_url: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number | null;
};

export type LinkedInPerformanceAccount = {
  page_id: string;
  account_label: string;
  status: "ok" | "error" | "not_connected";
  error: string | null;
  summary: {
    followers: number | null;
    post_count: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    avg_engagement_rate: number | null;
  } | null;
  posts: LinkedInPerformancePost[];
  posts_truncated?: boolean;
};

export type LinkedInPerformanceSource = {
  period: { start: string; end: string; time_zone?: string };
  how_to_read: string;
  count: number;
  accounts: LinkedInPerformanceAccount[];
};

export function parseLinkedInPerformanceQuery(args: unknown): LinkedInPerformanceQuery | null {
  const parsed = linkedinPerformanceInput.safeParse(args ?? {});
  if (!parsed.success) return null;
  const start = parsed.data.date_start ?? null;
  const end = parsed.data.date_end ?? null;
  if ((start && !end) || (!start && end)) return null;
  if (start && end && start > end) return null;
  return {
    pageId: parsed.data.page_id?.trim() || null,
    dateStart: start,
    dateEnd: end,
    limit: parsed.data.limit ?? 25,
  };
}

export function isLinkedInPerformanceSource(value: unknown): value is LinkedInPerformanceSource {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return Array.isArray(body.accounts) && body.period != null && typeof body.how_to_read === "string";
}

export async function linkedinPerformanceResult(
  ctx: McpAuthContext,
  query: LinkedInPerformanceQuery,
  read: (ctx: McpAuthContext, query: LinkedInPerformanceQuery) => Promise<LinkedInPerformanceSource>,
) {
  const source = await read(ctx, query);
  return {
    period: source.period,
    how_to_read: source.how_to_read,
    count: source.count,
    accounts: source.accounts.map((account) => ({
      page_id: account.page_id,
      account_label: account.account_label,
      status: account.status,
      error: account.error,
      summary: account.summary,
      posts: account.posts,
      posts_truncated: account.posts_truncated ?? false,
    })),
  };
}
