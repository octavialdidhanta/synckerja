/** Mirror of src/meta-platform/constants/metaOAuthScopes.ts for edge functions. */
export const META_BUSINESS_OAUTH_SCOPE_LIST = [
  "pages_show_list",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_messaging",
  "business_management",
] as const;

export const META_SCOPE_FEATURE_MAP = {
  instagram_dm: ["instagram_manage_messages", "pages_messaging"],
  messenger_dm: ["pages_messaging", "pages_manage_metadata"],
  dm: ["instagram_manage_messages", "pages_messaging"],
  comments: ["instagram_manage_comments", "pages_manage_engagement"],
  insights: ["instagram_manage_insights", "pages_read_engagement"],
  pages: ["pages_show_list", "pages_manage_metadata"],
  threads_insights: ["threads_basic", "threads_manage_insights"],
  threads_replies: [
    "threads_basic",
    "threads_read_replies",
    "threads_manage_replies",
    "threads_content_publish",
  ],
} as const;

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
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return required.filter((s) => !grantedSet.has(s.toLowerCase()));
}

export function hasAllScopes(granted: string[], required: readonly string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return required.every((s) => grantedSet.has(s.toLowerCase()));
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
