/** Read-only judgment of whether a Threads token may publish a feed post. */

export type ThreadsFeedPublishLimitPayload = {
  data?: Array<{
    quota_usage?: number | string;
    config?: { quota_total?: number | string; quota_duration?: number | string };
    reply_quota_usage?: number | string;
    reply_config?: { quota_total?: number | string; quota_duration?: number | string };
  }>;
};

export type ThreadsFeedPublishReadinessReason =
  | "missing_scope"
  | "post_quota_absent"
  | "post_quota_zero"
  | "api_error";

export type ThreadsFeedPublishReadiness = {
  ok: boolean;
  reason: ThreadsFeedPublishReadinessReason | null;
  detail: string | null;
  quota_total: number | null;
  quota_usage: number | null;
  reply_quota_total: number | null;
  has_content_publish: boolean;
  has_delete_scope: boolean;
};

const FEED_SCOPES = ["threads_basic", "threads_content_publish"] as const;

function hasScope(scopes: string[], name: string): boolean {
  const want = name.toLowerCase();
  return scopes.some((scope) => scope.trim().toLowerCase() === want);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function interpretThreadsFeedPublishLimit(input: {
  scopes: string[];
  payload?: ThreadsFeedPublishLimitPayload | null;
  apiError?: string | null;
}): ThreadsFeedPublishReadiness {
  const scopes = Array.isArray(input.scopes) ? input.scopes : [];
  const row = input.payload?.data?.[0];
  const quotaTotal = finiteNumber(row?.config?.quota_total);
  const quotaUsage = finiteNumber(row?.quota_usage);
  const replyQuotaTotal = finiteNumber(row?.reply_config?.quota_total);
  const hasContentPublish = hasScope(scopes, "threads_content_publish");
  const hasDeleteScope = hasScope(scopes, "threads_delete");
  const base = {
    quota_total: quotaTotal,
    quota_usage: quotaUsage,
    reply_quota_total: replyQuotaTotal,
    has_content_publish: hasContentPublish,
    has_delete_scope: hasDeleteScope,
  };

  const missing = FEED_SCOPES.filter((scope) => !hasScope(scopes, scope));
  if (missing.length > 0) {
    return { ok: false, reason: "missing_scope", detail: missing.join(","), ...base };
  }

  const apiError = typeof input.apiError === "string" ? input.apiError.trim() : "";
  if (apiError) {
    return { ok: false, reason: "api_error", detail: apiError, ...base };
  }

  if (quotaTotal == null) {
    return { ok: false, reason: "post_quota_absent", detail: null, ...base };
  }
  if (quotaTotal <= 0) {
    return { ok: false, reason: "post_quota_zero", detail: null, ...base };
  }

  return { ok: true, reason: null, detail: null, ...base };
}
