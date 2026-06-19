import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptThreadsContentToken,
  encryptThreadsContentToken,
} from "./threadsContentConfigCrypto.ts";
import { refreshThreadsAccessToken } from "./threadsContentApi.ts";
import { missingScopesForFeature, META_SCOPE_FEATURE_MAP } from "./metaPlatformScopes.ts";
import {
  isThreadsAppConfigured,
  threadsAppConfigErrorMessage,
} from "./threadsAppCredentials.ts";

export const threadsContentCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const THREADS_SCOPE_FEATURE_MAP = {
  threads_insights: META_SCOPE_FEATURE_MAP.threads_insights,
  threads_replies: META_SCOPE_FEATURE_MAP.threads_replies,
} as const;

export function threadsContentJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...threadsContentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function parseThreadsGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function isThreadsPlatformConfigured(): boolean {
  return isThreadsAppConfigured();
}

export function requireThreadsPlatformConfigured(): Response | null {
  if (!isThreadsPlatformConfigured()) {
    return threadsContentJson({ error: threadsAppConfigErrorMessage() }, 503);
  }
  return null;
}

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: threadsContentJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: threadsContentJson({ error: "Invalid token" }, 401) };
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
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return threadsContentJson({ error: "Forbidden" }, 403);
  }
  return null;
}

export type ResolvedThreadsAccount = {
  threadsUserId: string;
  threadsUsername: string | null;
  threadsProfilePictureUrl: string | null;
  instagramBusinessAccountId: string;
  accountLabel: string;
  grantedScopes: string[];
};

export async function resolveThreadsContentAccount(
  admin: SupabaseClient,
  organizationId: string,
  accountId: string,
): Promise<ResolvedThreadsAccount | null> {
  const { data: byIg } = await admin
    .from("organization_instagram_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("instagram_business_account_id", accountId)
    .eq("is_active", true)
    .eq("has_threads", true)
    .maybeSingle();

  let row = byIg;
  if (!row) {
    const { data: byThreadsRows } = await admin
      .from("organization_instagram_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("threads_user_id", accountId)
      .eq("is_active", true)
      .eq("has_threads", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    row = (byThreadsRows ?? [])[0] ?? null;
  }

  if (!row) return null;
  const r = row as Record<string, unknown>;
  const threadsUserId = String(r.threads_user_id ?? "").trim();
  if (!threadsUserId) return null;

  return {
    threadsUserId,
    threadsUsername: typeof r.threads_username === "string" ? r.threads_username : null,
    threadsProfilePictureUrl: typeof r.threads_profile_picture_url === "string"
      ? r.threads_profile_picture_url
      : null,
    instagramBusinessAccountId: String(r.instagram_business_account_id ?? accountId),
    accountLabel: String(
      r.threads_username ?? r.instagram_username ?? r.instagram_name ?? threadsUserId,
    ),
    grantedScopes: parseThreadsGrantedScopes(r.granted_scopes),
  };
}

export async function getThreadsAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserId: string,
): Promise<string | null> {
  const { data: tokenRows, error: tokenErr } = await admin
    .from("organization_instagram_accounts")
    .select("threads_access_token_enc, threads_token_expires_at")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("has_threads", true)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tokenErr) {
    console.error("getThreadsAccessToken query:", tokenErr.message);
    return null;
  }

  const row = (tokenRows ?? [])[0] as
    | { threads_access_token_enc: string; threads_token_expires_at: string | null }
    | undefined;
  if (!row?.threads_access_token_enc) return null;

  const expiresAtMs = row.threads_token_expires_at
    ? new Date(String(row.threads_token_expires_at)).getTime()
    : null;
  const needsRefresh = expiresAtMs != null &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs < Date.now() + 60_000;

  if (!needsRefresh) {
    try {
      return await decryptThreadsContentToken(String(row.threads_access_token_enc));
    } catch (e) {
      console.error("getThreadsAccessToken decrypt:", e);
    }
  }

  let currentToken: string;
  try {
    currentToken = await decryptThreadsContentToken(String(row.threads_access_token_enc));
  } catch (e) {
    console.error("getThreadsAccessToken refresh decrypt:", e);
    return null;
  }

  const refreshed = await refreshThreadsAccessToken(currentToken);
  if (!refreshed?.access_token) {
    return currentToken;
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptThreadsContentToken(refreshed.access_token);
  const accessExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : row.threads_token_expires_at;

  await admin
    .from("organization_instagram_accounts")
    .update({
      threads_access_token_enc: accessEnc,
      threads_token_expires_at: accessExpires,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId);

  return refreshed.access_token;
}

export async function resolveOrgThreadsContent(
  admin: SupabaseClient,
  organizationId: string,
  accountIdParam?: string | null,
): Promise<{ accessToken: string; account: ResolvedThreadsAccount } | null> {
  let account: ResolvedThreadsAccount | null = null;

  if (accountIdParam?.trim()) {
    account = await resolveThreadsContentAccount(admin, organizationId, accountIdParam.trim());
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_instagram_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("has_threads", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (defaultRow) {
      const igId = String((defaultRow as Record<string, unknown>).instagram_business_account_id ?? "");
      if (igId) account = await resolveThreadsContentAccount(admin, organizationId, igId);
    }
  }

  if (!account) return null;

  const accessToken = await getThreadsAccessToken(admin, organizationId, account.threadsUserId);
  if (!accessToken) return null;

  return { accessToken, account };
}

export async function listThreadsContentAccounts(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Array<{
  platform: "threads";
  account_id: string;
  threads_user_id: string;
  account_label: string;
  avatar_url: string | null;
  granted_scopes: string[];
  instagram_business_account_id: string;
  feature_status: Record<string, { ok: boolean; missing: string[] }>;
}>> {
  const { data: rows } = await admin
    .from("organization_instagram_accounts")
    .select(
      "instagram_business_account_id, threads_user_id, threads_username, instagram_username, instagram_name, threads_profile_picture_url, granted_scopes",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("has_threads", true);

  const features = Object.keys(THREADS_SCOPE_FEATURE_MAP) as Array<keyof typeof THREADS_SCOPE_FEATURE_MAP>;

  return (rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const threadsUserId = String(r.threads_user_id ?? "");
    const igId = String(r.instagram_business_account_id ?? "");
    const grantedScopes = parseThreadsGrantedScopes(r.granted_scopes);
    const featureStatus = Object.fromEntries(
      features.map((f) => [f, {
        ok: missingScopesForFeature(grantedScopes, f).length === 0,
        missing: missingScopesForFeature(grantedScopes, f),
      }]),
    );
    return {
      platform: "threads" as const,
      account_id: igId || threadsUserId,
      threads_user_id: threadsUserId,
      account_label: String(r.threads_username ?? r.instagram_username ?? r.instagram_name ?? threadsUserId),
      avatar_url: typeof r.threads_profile_picture_url === "string" ? r.threads_profile_picture_url : null,
      granted_scopes: grantedScopes,
      instagram_business_account_id: igId,
      feature_status: featureStatus,
    };
  });
}
