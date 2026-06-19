export const LINKEDIN_SCOPE_FEATURE_MAP = {
  insights: ['r_organization_social_feed'] as const,
  comments: ['r_organization_social_feed', 'w_organization_social_feed'] as const,
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
