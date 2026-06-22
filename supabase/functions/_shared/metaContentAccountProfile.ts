import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  graphUrl,
  resolveMetaContentAccount,
  type MetaContentPlatform,
} from "./metaContentAuth.ts";

type GraphError = { error?: { message?: string } };

async function graphGetFields<T>(
  nodeId: string,
  accessToken: string,
  fields: string,
): Promise<T | null> {
  try {
    const url = graphUrl(nodeId, { fields });
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(accessToken)}`);
    const data = await res.json().catch(() => ({})) as T & GraphError;
    if (!res.ok || data?.error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchMetaAccountProfilePictureUrl(
  platform: MetaContentPlatform,
  accountId: string,
  accessToken: string,
): Promise<string | null> {
  if (platform === "instagram") {
    const data = await graphGetFields<{ profile_picture_url?: string }>(
      accountId,
      accessToken,
      "profile_picture_url",
    );
    return data?.profile_picture_url?.trim() || null;
  }

  const data = await graphGetFields<{ picture?: { data?: { url?: string } } }>(
    accountId,
    accessToken,
    "picture.type(large)",
  );
  return data?.picture?.data?.url?.trim() || null;
}

export type MetaContentAccountListRow = {
  platform: MetaContentPlatform;
  account_id: string;
  account_label: string;
  page_id: string;
  granted_scopes: string[];
  avatar_url: string | null;
};

export async function enrichMetaContentAccountsWithAvatars(
  admin: SupabaseClient,
  organizationId: string,
  accounts: MetaContentAccountListRow[],
): Promise<MetaContentAccountListRow[]> {
  const enriched = await Promise.all(
    accounts.map(async (acc) => {
      const resolved = await resolveMetaContentAccount(
        admin,
        organizationId,
        acc.platform,
        acc.account_id,
      );
      if (!resolved) return acc;

      const graphNodeId = acc.platform === "instagram"
        ? resolved.igBusinessAccountId ?? acc.account_id
        : resolved.pageId;

      const avatarUrl = await fetchMetaAccountProfilePictureUrl(
        acc.platform,
        graphNodeId,
        resolved.pageAccessToken,
      );

      return { ...acc, avatar_url: avatarUrl };
    }),
  );

  return enriched;
}
