export const PHASE0_SCOPES = ["session:read", "content:read"] as const;

export type Phase0Scope = (typeof PHASE0_SCOPES)[number];

const SCOPE_SET = new Set<string>(PHASE0_SCOPES);

export function parseRequestedScope(raw: string | null | undefined): string[] | null {
  const text = (raw ?? "").trim();
  if (!text) return [...PHASE0_SCOPES];
  const scopes = text.split(/\s+/).filter(Boolean);
  if (scopes.length === 0) return [...PHASE0_SCOPES];
  if (scopes.some((scope) => !SCOPE_SET.has(scope))) return null;
  return [...new Set(scopes)];
}

export function formatScope(scopes: string[]): string {
  return scopes.join(" ");
}
