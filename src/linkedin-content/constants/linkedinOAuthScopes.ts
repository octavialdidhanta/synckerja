/**
 * Personal profile connect scopes (Share on LinkedIn). Server-only on oauthStart when
 * connect_kind=person — mirror for docs/UI; do not merge into page OAuth defaults.
 */
/**
 * Mirror of server member authorize scopes. Do not add r_member_social /
 * r_member_postAnalytics here until LinkedIn Auth tab accepts them (invalid_scope).
 */
export const LINKEDIN_CONTENT_MEMBER_OAUTH_SCOPES_DEFAULT = [
  'w_member_social',
  'r_basicprofile',
].join(' ');

export const LINKEDIN_SCOPE_FEATURE_MAP = {
  insights: ['r_organization_social'] as const,
  comments: ['r_organization_social_feed', 'w_organization_social_feed'] as const,
  publish: ['w_organization_social'] as const,
  /** Personal profile publish (Share on LinkedIn). Requested via member OAuth only. */
  memberPublish: ['w_member_social'] as const,
  /** Personal profile insights (Posts finder + memberCreatorPostAnalytics). */
  memberInsights: ['r_member_social', 'r_member_postAnalytics'] as const,
  pages: ['rw_organization_admin'] as const,
} as const;

export function parseLinkedInGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function missingLinkedInScopesForFeature(
  granted: string[],
  feature: keyof typeof LINKEDIN_SCOPE_FEATURE_MAP,
): string[] {
  const required = LINKEDIN_SCOPE_FEATURE_MAP[feature];
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return required.filter((s) => !grantedSet.has(s.toLowerCase()));
}

/** True when LinkedIn granted both member insights scopes (Performance nav gate). */
export function linkedInPersonHasInsightsScopes(grantedScopes: unknown): boolean {
  return missingLinkedInScopesForFeature(
    parseLinkedInGrantedScopes(grantedScopes),
    "memberInsights",
  ).length === 0;
}
