export type CanvaIdentity = {
  userId: string | null;
  teamId: string | null;
  displayName: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export async function fetchCanvaIdentity(accessToken: string): Promise<CanvaIdentity> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [meRes, profileRes] = await Promise.all([
    fetch("https://api.canva.com/rest/v1/users/me", { headers }),
    fetch("https://api.canva.com/rest/v1/users/me/profile", { headers }),
  ]);

  const meJson = meRes.ok ? asRecord(await meRes.json().catch(() => null)) : null;
  const teamUser = asRecord(meJson?.team_user);
  const profileJson = profileRes.ok ? asRecord(await profileRes.json().catch(() => null)) : null;
  const profile = asRecord(profileJson?.profile);

  return {
    userId: textField(teamUser, "user_id"),
    teamId: textField(teamUser, "team_id"),
    displayName: textField(profile, "display_name"),
  };
}
