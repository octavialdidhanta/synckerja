import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptLinkedInContentToken,
  encryptLinkedInContentToken,
} from "./linkedinContentConfigCrypto.ts";
import {
  missingLinkedInScopesForFeature,
  parseLinkedInGrantedScopes,
  readPlatformLinkedInContentOAuth,
} from "./linkedinContentAuth.ts";
import {
  buildLinkedInAuthorUrn,
  refreshLinkedInContentAccessToken,
} from "./linkedinContentApi.ts";

export type LinkedInContentAccountKind = "organization" | "person";
export type LinkedInPublishScopeFeature = "publish" | "memberPublish";

export type LinkedInContentAccountRow = {
  id: string;
  organization_id: string;
  page_id: string;
  account_kind?: LinkedInContentAccountKind | string | null;
  label: string;
  display_name: string | null;
  thumbnail_url: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  granted_scopes?: unknown;
};

export function isLinkedInPersonAccount(
  account: Pick<LinkedInContentAccountRow, "account_kind"> | null | undefined,
): boolean {
  return String(account?.account_kind ?? "organization") === "person";
}

export function normalizeLinkedInAccountKind(
  raw: unknown,
): LinkedInContentAccountKind {
  return String(raw ?? "").trim() === "person" ? "person" : "organization";
}

export function linkedInPublishScopeFeature(
  accountKind: LinkedInContentAccountKind,
): LinkedInPublishScopeFeature {
  return accountKind === "person" ? "memberPublish" : "publish";
}

export type LinkedInPublishAccount = {
  accessToken: string;
  pageId: string;
  accountKind: LinkedInContentAccountKind;
  authorUrn: string;
  accountLabel: string;
  grantedScopes: string[];
  scopeFeature: LinkedInPublishScopeFeature;
};

/** Resolve token + author URN for Reel/carousel publish (org page or personal member). */
export async function resolveLinkedInPublishAccount(
  admin: SupabaseClient,
  organizationId: string,
  pageIdParam: string,
): Promise<LinkedInPublishAccount | null> {
  const pageId = String(pageIdParam ?? "").trim();
  if (!pageId) return null;

  const { data: row } = await admin
    .from("organization_linkedin_content_accounts")
    .select("page_id, account_kind, label, display_name, granted_scopes, is_active")
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .eq("is_active", true)
    .maybeSingle();
  if (!row?.page_id) return null;

  const accountKind = normalizeLinkedInAccountKind(
    (row as { account_kind?: string }).account_kind,
  );
  const accessToken = await getLinkedInContentAccessToken(admin, organizationId, pageId);
  if (!accessToken) return null;

  const grantedScopes = parseLinkedInGrantedScopes(
    (row as { granted_scopes?: unknown }).granted_scopes,
  );
  const accountLabel = String(
    (row as { display_name?: string | null }).display_name ??
      (row as { label?: string | null }).label ??
      "LinkedIn",
  );

  return {
    accessToken,
    pageId,
    accountKind,
    authorUrn: buildLinkedInAuthorUrn(accountKind, pageId),
    accountLabel,
    grantedScopes,
    scopeFeature: linkedInPublishScopeFeature(accountKind),
  };
}

export function linkedInPublishScopesOk(
  grantedScopes: string[],
  accountKind: LinkedInContentAccountKind,
): boolean {
  return missingLinkedInScopesForFeature(
    grantedScopes,
    linkedInPublishScopeFeature(accountKind),
  ).length === 0;
}

type TokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  access_token_expires_at: string | null;
};

export async function getLinkedInContentAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
  options?: { forceRefresh?: boolean },
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_linkedin_content_connection_tokens")
    .select("access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .maybeSingle();
  if (!row?.access_token_enc || !row?.refresh_token_enc) return null;

  const tokenRow = row as TokenRow;
  const expiresAtMs = tokenRow.access_token_expires_at
    ? new Date(String(tokenRow.access_token_expires_at)).getTime()
    : null;
  const needsRefresh = options?.forceRefresh === true ||
    (expiresAtMs != null &&
      Number.isFinite(expiresAtMs) &&
      expiresAtMs < Date.now() + 60_000);

  if (!needsRefresh) {
    try {
      return await decryptLinkedInContentToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getLinkedInContentAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptLinkedInContentToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getLinkedInContentAccessToken refresh decrypt:", e);
    return null;
  }

  const oauth = readPlatformLinkedInContentOAuth();
  const refreshed = oauth
    ? await refreshLinkedInContentAccessToken(oauth.clientId, oauth.clientSecret, refreshToken)
    : null;

  if (!refreshed?.access_token) {
    try {
      return await decryptLinkedInContentToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptLinkedInContentToken(refreshed.access_token);
  const refreshEnc = refreshed.refresh_token
    ? await encryptLinkedInContentToken(refreshed.refresh_token)
    : String(tokenRow.refresh_token_enc);
  const accessExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : tokenRow.access_token_expires_at;

  await admin.from("organization_linkedin_content_connection_tokens").update({
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    updated_at: now,
  }).eq("organization_id", organizationId).eq("page_id", pageId);

  return refreshed.access_token;
}

/** Org Company Page metrics/comments only — never returns person accounts. */
export async function resolveOrgLinkedInContentForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  pageIdParam?: string | null,
): Promise<{ accessToken: string; account: LinkedInContentAccountRow } | null> {
  const resolved = await resolveLinkedInContentForMetrics(admin, organizationId, pageIdParam, {
    allowPerson: false,
  });
  return resolved;
}

/** Performance metrics: organization pages and (when allowPerson) personal profiles. */
export async function resolveLinkedInContentForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  pageIdParam?: string | null,
  options?: { allowPerson?: boolean },
): Promise<{ accessToken: string; account: LinkedInContentAccountRow } | null> {
  const allowPerson = options?.allowPerson === true;
  let account: LinkedInContentAccountRow | null = null;

  if (pageIdParam) {
    const { data: row } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("page_id", pageIdParam.trim())
      .maybeSingle();
    if (row) account = row as LinkedInContentAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .eq("account_kind", "organization")
      .maybeSingle();
    account = (defaultRow as LinkedInContentAccountRow | null) ?? null;
  }

  if (!account) {
    const { data: firstRow } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("account_kind", "organization")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = (firstRow as LinkedInContentAccountRow | null) ?? null;
  }

  if (!account?.page_id) return null;
  if (isLinkedInPersonAccount(account) && !allowPerson) return null;

  const accessToken = await getLinkedInContentAccessToken(admin, organizationId, account.page_id);
  if (!accessToken) return null;

  return { accessToken, account };
}
