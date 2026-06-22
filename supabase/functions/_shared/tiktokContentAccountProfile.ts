import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchTikTokUserInfo } from "./tiktokContentApi.ts";
import { getTikTokContentAccessToken } from "./tiktokContentOrgResolver.ts";

type AccountRow = {
  id: string;
  open_id: string;
  label: string;
  display_name: string | null;
  avatar_url?: string | null;
  is_active: boolean;
};

/** Labels generated before we fetched TikTok profile (open_id fragment). */
export function isPlaceholderTikTokAccountLabel(
  label: string | null | undefined,
  openId: string,
): boolean {
  const trimmed = label?.trim() ?? "";
  if (!trimmed) return true;
  if (trimmed === openId) return true;
  if (/^TikTok\s+-?[\w]{4,16}$/i.test(trimmed)) return true;
  const idPrefix = openId.replace(/^-/, "").slice(0, 8);
  if (idPrefix && trimmed.toLowerCase().includes(idPrefix.toLowerCase())) return true;
  return false;
}

export function pickTikTokAccountLabel(account: {
  label?: string | null;
  display_name?: string | null;
  open_id: string;
}): string {
  for (const raw of [account.display_name, account.label]) {
    const name = raw?.trim() ?? "";
    if (name && !isPlaceholderTikTokAccountLabel(name, account.open_id)) return name;
  }
  return account.display_name?.trim() || account.label?.trim() || "TikTok";
}

export async function fetchTikTokAccountProfileFromApi(
  accessToken: string,
): Promise<{ displayName: string | null; avatarUrl: string | null } | null> {
  try {
    const user = await fetchTikTokUserInfo(accessToken);
    return {
      displayName: user.display_name?.trim() || null,
      avatarUrl: user.avatar_url?.trim() || null,
    };
  } catch (e) {
    console.warn("fetchTikTokAccountProfileFromApi:", e instanceof Error ? e.message : e);
    return null;
  }
}

function isTikTokHostedAvatarUrl(url: string | null | undefined): boolean {
  const u = url?.trim().toLowerCase() ?? "";
  if (!u) return false;
  return (
    u.includes("tiktokcdn")
    || u.includes("tiktokv.com")
    || u.includes("muscdn.com")
    || u.includes("byteoversea.com")
  );
}

export async function syncTikTokContentAccountProfiles(
  admin: SupabaseClient,
  organizationId: string,
  accounts: AccountRow[],
): Promise<number> {
  let updated = 0;
  const now = new Date().toISOString();

  for (const acc of accounts) {
    if (!acc.is_active) continue;
    const needsLabelSync = isPlaceholderTikTokAccountLabel(acc.label, acc.open_id)
      || isPlaceholderTikTokAccountLabel(acc.display_name, acc.open_id);
    const needsAvatarSync = !acc.avatar_url?.trim() || isTikTokHostedAvatarUrl(acc.avatar_url);
    if (!needsLabelSync && !needsAvatarSync) continue;

    const tokenResult = await getTikTokContentAccessToken(admin, organizationId, acc.open_id);
    if (!tokenResult) continue;

    const profile = await fetchTikTokAccountProfileFromApi(tokenResult.accessToken);
    if (!profile) continue;
    if (!needsLabelSync && !profile.avatarUrl) continue;

    const updatePayload: Record<string, string | null> = { updated_at: now };
    if (needsLabelSync && profile.displayName) {
      updatePayload.label = profile.displayName;
      updatePayload.display_name = profile.displayName;
    }
    if (needsAvatarSync && profile.avatarUrl) {
      updatePayload.avatar_url = profile.avatarUrl;
    }
    if (Object.keys(updatePayload).length <= 1) continue;

    const { error } = await admin
      .from("organization_tiktok_content_accounts")
      .update(updatePayload)
      .eq("id", acc.id)
      .eq("organization_id", organizationId);

    if (!error) updated += 1;
  }

  return updated;
}
