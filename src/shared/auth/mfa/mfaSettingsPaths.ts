const MFA_SECURITY_PATH = "/settings/security";

export function mfaSecuritySettingsPath(query?: Record<string, string | undefined>): string {
  if (!query || Object.keys(query).length === 0) {
    return MFA_SECURITY_PATH;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${MFA_SECURITY_PATH}?${qs}` : MFA_SECURITY_PATH;
}
