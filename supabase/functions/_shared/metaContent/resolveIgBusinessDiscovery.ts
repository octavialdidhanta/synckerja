import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { metaGraphVersion } from "../metaPlatformScopes.ts";

export type IgBusinessDiscoveryProfile = {
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
};

/**
 * Exact-username resolve via Instagram Graph business_discovery.
 * Returns null when not found / no permission / network error.
 */
export async function resolveIgBusinessDiscovery(args: {
  igBusinessAccountId: string;
  pageAccessToken: string;
  username: string;
}): Promise<IgBusinessDiscoveryProfile | null> {
  const username = args.username.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{2,30}$/.test(username)) return null;
  if (!args.igBusinessAccountId || !args.pageAccessToken) return null;

  const version = metaGraphVersion();
  const fields =
    `business_discovery.username(${username}){username,name,profile_picture_url,followers_count}`;
  const url =
    `https://graph.facebook.com/${version}/${encodeURIComponent(args.igBusinessAccountId)}` +
    `?fields=${encodeURIComponent(fields)}` +
    `&access_token=${encodeURIComponent(args.pageAccessToken)}`;

  try {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({})) as {
      business_discovery?: {
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
      error?: { message?: string };
    };
    if (!res.ok || json.error || !json.business_discovery?.username) {
      return null;
    }
    const bd = json.business_discovery;
    return {
      username: String(bd.username).replace(/^@+/, ""),
      name: bd.name ? String(bd.name) : null,
      profilePictureUrl: bd.profile_picture_url ? String(bd.profile_picture_url) : null,
      followersCount:
        typeof bd.followers_count === "number" ? bd.followers_count : null,
    };
  } catch {
    return null;
  }
}

/** First active IG business account + page token for the org. */
export async function getOrgPrimaryIgAccountForDiscovery(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ igBusinessAccountId: string; pageAccessToken: string } | null> {
  const { data } = await admin
    .from("organization_instagram_accounts")
    .select("instagram_business_account_id, page_access_token")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const igId = String(row.instagram_business_account_id ?? "").trim();
  const token = String(row.page_access_token ?? "").trim();
  if (!igId || !token) return null;
  return { igBusinessAccountId: igId, pageAccessToken: token };
}
