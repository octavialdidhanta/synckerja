/** Build `/login/mfa` path with optional post-verify redirect target. */
export function mfaLoginChallengePath(redirectTo?: string | null): string {
  if (!redirectTo?.trim()) return "/login/mfa";
  return `/login/mfa?redirectTo=${encodeURIComponent(redirectTo)}`;
}
