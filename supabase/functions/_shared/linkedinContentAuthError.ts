/** LinkedIn often returns this after a sibling OAuth (e.g. personal) revokes page tokens. */
export const LINKEDIN_AUTH_FAIL_RE =
  /Could not authenticate|Unauthorized|invalid.?token|token.?expired|REVOKED_ACCESS_TOKEN/i;

export function isLinkedInContentAuthFailure(message: string): boolean {
  return LINKEDIN_AUTH_FAIL_RE.test(String(message ?? ""));
}

export function linkedInContentReauthErrorMessage(
  accountKind: "organization" | "person" = "organization",
): string {
  return accountKind === "person"
    ? "LinkedIn personal connection expired or was revoked. Reconnect personal profile in LinkedIn settings, then retry."
    : "LinkedIn connection expired or was revoked. Reconnect this Company Page in LinkedIn settings (after connecting personal, page tokens often need a fresh connect), then retry.";
}

export function mapLinkedInContentAuthFailure(
  message: string,
  accountKind: "organization" | "person" = "organization",
): { error: string; code: "LINKEDIN_CONTENT_REAUTH_REQUIRED"; linkedin_error: string } | null {
  if (!isLinkedInContentAuthFailure(message)) return null;
  return {
    error: linkedInContentReauthErrorMessage(accountKind),
    code: "LINKEDIN_CONTENT_REAUTH_REQUIRED",
    linkedin_error: message,
  };
}
