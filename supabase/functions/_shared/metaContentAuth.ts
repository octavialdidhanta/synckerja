import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { metaGraphVersion } from "./metaPlatformScopes.ts";

export type MetaContentPlatform = "instagram" | "facebook";

export const metaContentCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function metaContentJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...metaContentCorsHeaders, "Content-Type": "application/json" },
  });
}

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: metaContentJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: metaContentJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function requireActiveOrg(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userId)
    .single();
  if (profile?.active_organization_id !== organizationId) {
    return metaContentJson({ error: "Organization access denied" }, 403);
  }
  return null;
}

export type ResolvedMetaAccount = {
  platform: MetaContentPlatform;
  accountId: string;
  accountLabel: string;
  pageId: string;
  pageAccessToken: string;
  igBusinessAccountId: string | null;
  grantedScopes: string[];
};

function parseScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export async function resolveMetaContentAccount(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
): Promise<ResolvedMetaAccount | null> {
  if (platform === "instagram") {
    const { data } = await admin
      .from("organization_instagram_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("instagram_business_account_id", accountId)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    const row = data as Record<string, unknown>;
    const token = String(row.page_access_token ?? "").trim();
    const pageId = String(row.facebook_page_id ?? "").trim();
    if (!token || !pageId) return null;
    return {
      platform: "instagram",
      accountId,
      accountLabel: String(row.instagram_username ?? row.instagram_name ?? accountId),
      pageId,
      pageAccessToken: token,
      igBusinessAccountId: accountId,
      grantedScopes: parseScopes(row.granted_scopes),
    };
  }

  // Facebook Content / Messenger pages come only from organization_facebook_pages.
  // Do not treat Instagram-linked page ids as connected Facebook accounts — disconnecting
  // a Page removes the FB row while the IG row may remain for Instagram DM.
  const { data } = await admin
    .from("organization_facebook_pages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("facebook_page_id", accountId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const token = String(row.page_access_token ?? "").trim();
  if (!token) return null;
  return {
    platform: "facebook",
    accountId,
    accountLabel: String(row.page_name ?? accountId),
    pageId: accountId,
    pageAccessToken: token,
    igBusinessAccountId: null,
    grantedScopes: parseScopes(row.granted_scopes),
  };
}

export async function listMetaContentAccounts(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Array<{
  platform: MetaContentPlatform;
  account_id: string;
  account_label: string;
  page_id: string;
  granted_scopes: string[];
  avatar_url: string | null;
}>> {
  const [igRes, fbRes] = await Promise.all([
    admin
      .from("organization_instagram_accounts")
      .select(
        "instagram_business_account_id, instagram_username, instagram_name, facebook_page_id, facebook_page_name, granted_scopes",
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    admin
      .from("organization_facebook_pages")
      .select("facebook_page_id, page_name, granted_scopes")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const igAccounts = (igRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      platform: "instagram" as const,
      account_id: String(r.instagram_business_account_id),
      account_label: String(r.instagram_username ?? r.instagram_name ?? r.instagram_business_account_id),
      page_id: String(r.facebook_page_id ?? ""),
      granted_scopes: parseScopes(r.granted_scopes),
      avatar_url: null,
    };
  });

  const fbAccounts = (fbRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      platform: "facebook" as const,
      account_id: String(r.facebook_page_id),
      account_label: String(r.page_name ?? r.facebook_page_id),
      page_id: String(r.facebook_page_id),
      granted_scopes: parseScopes(r.granted_scopes),
      avatar_url: null,
    };
  });

  return [...igAccounts, ...fbAccounts];
}

export function graphUrl(path: string, params?: Record<string, string>): string {
  const version = metaGraphVersion();
  const base = `https://graph.facebook.com/${version}/${path}`;
  if (!params || Object.keys(params).length === 0) return base;
  const qs = new URLSearchParams(params);
  return `${base}?${qs.toString()}`;
}
