import type { McpServiceConfig } from "../config";
import { isCommentsSource, type CommentsQuery, type CommentsSource } from "../tools/comments/commentsQuery";

type Session = { userId: string; organizationId: string };
type DoorConfig = Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">;

function scrub(value: unknown, secret: string): string | null {
  if (typeof value !== "string") return null;
  const cleaned = (secret ? value.split(secret).join("") : value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/** Reads comments through the mcp-social-comments edge function (read only). */
export async function readSocialComments(
  config: DoorConfig,
  ctx: Session,
  query: CommentsQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<CommentsSource> {
  const secret = config.scheduledPostsInternalSecret;
  const response = await fetchImpl(`${config.supabaseUrl}/functions/v1/mcp-social-comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: ctx.organizationId,
      mcp_user_id: ctx.userId,
      internal_secret: secret,
      platform: query.platform,
      date_start: query.dateStart,
      date_end: query.dateEnd,
      posts_per_account: query.postsPerAccount,
    }),
  });

  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const raw = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
    const error = (scrub(raw, secret) ?? "").slice(0, 180);
    console.error("comments: function rejected", {
      status: response.status,
      error,
      organizationId: ctx.organizationId,
      platform: query.platform,
    });
    if (error.startsWith("forbidden:")) throw new Error(error);
    if (response.status === 403) throw new Error("forbidden: comments door rejected");
    if (response.status === 400) throw new Error("invalid_input");
    throw new Error("comments_unavailable");
  }
  if (!isCommentsSource(body)) throw new Error("comments_unavailable");
  return {
    ...body,
    accounts: body.accounts.map((account) => ({
      ...account,
      account_label: scrub(account.account_label, secret),
      error: account.error ? scrub(account.error, secret) ?? "request_failed" : null,
    })),
  };
}
