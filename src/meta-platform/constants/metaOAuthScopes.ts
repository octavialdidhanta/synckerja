/** Facebook Login for Business scopes — Connect Instagram + organic content + DM. */
export const META_BUSINESS_OAUTH_SCOPE_LIST = [
  'pages_show_list',
  'pages_manage_metadata',
  'instagram_basic',
  'instagram_manage_messages',
  'instagram_manage_comments',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_messaging',
  'business_management',
] as const;

export const META_BUSINESS_OAUTH_SCOPES = META_BUSINESS_OAUTH_SCOPE_LIST.join(',');

/** Threads API scopes — requested via threads.net OAuth, not Facebook Login. */
export const THREADS_OAUTH_SCOPE_LIST = [
  'threads_basic',
  'threads_manage_insights',
  'threads_read_replies',
  'threads_manage_replies',
] as const;

export const THREADS_OAUTH_SCOPES = THREADS_OAUTH_SCOPE_LIST.join(',');

export type MetaBusinessOAuthScope = (typeof META_BUSINESS_OAUTH_SCOPE_LIST)[number];

export function hasThreadsScopes(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return THREADS_OAUTH_SCOPE_LIST.some((s) => grantedSet.has(s.toLowerCase()));
}

export const META_SCOPE_FEATURE_MAP = {
  dm: ['instagram_manage_messages', 'pages_messaging'] as const,
  comments: ['instagram_manage_comments', 'pages_manage_engagement'] as const,
  insights: ['instagram_manage_insights', 'pages_read_engagement'] as const,
  pages: ['pages_show_list', 'pages_manage_metadata'] as const,
  threads_insights: ['threads_basic', 'threads_manage_insights'] as const,
  threads_replies: ['threads_basic', 'threads_read_replies', 'threads_manage_replies'] as const,
} as const;

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
