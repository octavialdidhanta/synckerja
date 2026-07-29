/** Mirror of src/meta-platform/constants/metaOAuthScopes.ts for edge functions. */
export const META_BUSINESS_OAUTH_SCOPE_LIST = [
  "pages_show_list",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_messaging",
  "business_management",
] as const;

export const META_FACEBOOK_PAGE_OAUTH_SCOPE_LIST = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "read_insights",
  "pages_manage_engagement",
  "pages_manage_posts",
  "pages_messaging",
  "business_management",
] as const;

export const META_SCOPE_FEATURE_MAP = {
  instagram_dm: ["instagram_manage_messages", "pages_messaging"],
  messenger_dm: ["pages_messaging", "pages_manage_metadata"],
  dm: ["instagram_manage_messages", "pages_messaging"],
  comments: ["instagram_manage_comments", "pages_manage_engagement"],
  insights: ["instagram_manage_insights", "pages_read_engagement"],
  publish: ["instagram_content_publish"],
  facebook_publish: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
  pages: ["pages_show_list", "pages_manage_metadata"],
  threads_insights: ["threads_basic", "threads_manage_insights"],
  threads_replies: [
    "threads_basic",
    "threads_read_replies",
    "threads_manage_replies",
    "threads_content_publish",
  ],
} as const;

/** Meta App Review may return legacy or business-prefixed Instagram scope names. */
export const META_SCOPE_ALIASES: Record<string, readonly string[]> = {
  instagram_manage_messages: ["instagram_business_manage_messages"],
  instagram_business_manage_messages: ["instagram_manage_messages"],
  instagram_basic: ["instagram_business_basic"],
  instagram_business_basic: ["instagram_basic"],
};

export const META_PENDING_APP_REVIEW_SCOPES = [
  "instagram_manage_comments",
  "pages_manage_engagement",
  "instagram_manage_insights",
  "pages_read_engagement",
  "read_insights",
  "instagram_content_publish",
  "pages_manage_posts",
  "business_management",
] as const;

function scopeAliasVariants(scope: string): string[] {
  const key = scope.toLowerCase();
  const aliases = META_SCOPE_ALIASES[key] ?? [];
  return [scope, ...aliases];
}

function isScopeGranted(grantedSet: Set<string>, requiredScope: string): boolean {
  return scopeAliasVariants(requiredScope).some((s) => grantedSet.has(s.toLowerCase()));
}

export function normalizeGrantedScopes(granted: string[]): string[] {
  const result = new Set<string>();
  for (const raw of granted) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    for (const variant of scopeAliasVariants(trimmed)) {
      result.add(variant);
    }
  }
  return [...result];
}

export function isPendingAppReviewScope(scope: string): boolean {
  const lower = scope.toLowerCase();
  return META_PENDING_APP_REVIEW_SCOPES.some((s) => s.toLowerCase() === lower);
}

export const THREADS_OAUTH_SCOPE_LIST = [
  "threads_basic",
  "threads_manage_insights",
  "threads_read_replies",
  "threads_manage_replies",
  "threads_content_publish",
] as const;

export function hasThreadsScopes(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return THREADS_OAUTH_SCOPE_LIST.some((s) => grantedSet.has(s.toLowerCase()));
}

export function metaGraphVersion(): string {
  return Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v22.0";
}

export function missingScopesForFeature(
  granted: string[],
  feature: keyof typeof META_SCOPE_FEATURE_MAP,
): string[] {
  const required = META_SCOPE_FEATURE_MAP[feature];
  const grantedSet = new Set(normalizeGrantedScopes(granted).map((s) => s.toLowerCase()));
  return required.filter((s) => !isScopeGranted(grantedSet, s));
}

export function hasAllScopes(granted: string[], required: readonly string[]): boolean {
  const grantedSet = new Set(normalizeGrantedScopes(granted).map((s) => s.toLowerCase()));
  return required.every((s) => isScopeGranted(grantedSet, s));
}

export function missingScopesForInstagramPublish(granted: string[]): string[] {
  return missingScopesForFeature(granted, "publish");
}

export function missingScopesForFacebookPublish(granted: string[]): string[] {
  return missingScopesForFeature(granted, "facebook_publish");
}

export function instagramPublishScopesOk(granted: string[]): boolean {
  return missingScopesForInstagramPublish(granted).length === 0;
}

export function facebookPublishScopesOk(granted: string[]): boolean {
  return missingScopesForFacebookPublish(granted).length === 0;
}

export async function fetchGrantedPermissions(
  accessToken: string,
  appId?: string,
): Promise<string[]> {
  const version = metaGraphVersion();
  const debugUrl = appId?.trim()
    ? `https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(Deno.env.get("META_APP_SECRET") ?? "")}`
    : null;

  if (debugUrl) {
    try {
      const res = await fetch(debugUrl);
      const data = await res.json().catch(() => ({})) as {
        data?: { scopes?: string[] };
      };
      if (res.ok && Array.isArray(data?.data?.scopes)) {
        return data.data.scopes.map((s) => String(s));
      }
    } catch {
      /* fall through */
    }
  }

  const permUrl = `https://graph.facebook.com/${version}/me/permissions?access_token=${encodeURIComponent(accessToken)}`;
  const permRes = await fetch(permUrl);
  const permData = await permRes.json().catch(() => ({})) as {
    data?: Array<{ permission?: string; status?: string }>;
  };
  if (!permRes.ok || !Array.isArray(permData?.data)) return [];
  return permData.data
    .filter((p) => p.status === "granted" && p.permission)
    .map((p) => String(p.permission));
}
