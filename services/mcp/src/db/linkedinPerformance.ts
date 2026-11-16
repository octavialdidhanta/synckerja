import type { McpServiceConfig } from "../config";
import {
  isLinkedInPerformanceSource,
  type LinkedInPerformanceQuery,
  type LinkedInPerformanceSource,
} from "../tools/linkedin/performanceQuery";

type Session = { userId: string; organizationId: string };
type DoorConfig = Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">;

function scrub(value: unknown, secret: string): string | null {
  if (typeof value !== "string") return null;
  const cleaned = (secret ? value.split(secret).join("") : value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/** Reads LinkedIn Company Page organic metrics through mcp-linkedin-metrics (read only). */
export async function readLinkedInPerformance(
  config: DoorConfig,
  ctx: Session,
  query: LinkedInPerformanceQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkedInPerformanceSource> {
  const secret = config.scheduledPostsInternalSecret;
  const response = await fetchImpl(`${config.supabaseUrl}/functions/v1/mcp-linkedin-metrics`, {
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
      page_id: query.pageId,
      date_start: query.dateStart,
      date_end: query.dateEnd,
      limit: query.limit,
    }),
  });

  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const raw = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
    const error = (scrub(raw, secret) ?? "").slice(0, 180);
    console.error("linkedin.performance: function rejected", {
      status: response.status,
      error,
      organizationId: ctx.organizationId,
    });
    if (error.startsWith("forbidden:")) throw new Error(error);
    if (response.status === 403) throw new Error("forbidden: linkedin metrics door rejected");
    if (response.status === 400) throw new Error("invalid_input");
    throw new Error("linkedin_metrics_unavailable");
  }
  if (!isLinkedInPerformanceSource(body)) throw new Error("linkedin_metrics_unavailable");
  return {
    ...body,
    accounts: body.accounts.map((account) => ({
      ...account,
      account_label: scrub(account.account_label, secret) ?? account.page_id,
      error: account.error ? scrub(account.error, secret) ?? "request_failed" : null,
    })),
  };
}
