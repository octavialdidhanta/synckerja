/** Build MFA challenge path with optional post-verify redirect target. */
export function mfaLoginChallengePath(
  redirectTo?: string | null,
  basePath = "/login/mfa",
): string {
  if (!redirectTo?.trim()) return basePath;
  return `${basePath}?redirectTo=${encodeURIComponent(redirectTo)}`;
}
