import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANVA_REVOKE_URL,
  CANVA_TOKEN_URL,
  canvaBasicAuth,
  canvaOAuthRedirectUri,
  readPlatformCanvaOAuth,
} from "./canvaAuth.ts";
import { decryptCanvaToken, encryptCanvaToken } from "./canvaConfigCrypto.ts";

export type CanvaTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  code?: string;
  message?: string;
  error?: string;
  error_description?: string;
};

const SKEW_MS = 60_000;

type TokenRow = {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
};

export async function exchangeCanvaAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<CanvaTokenResponse> {
  const oauth = readPlatformCanvaOAuth();
  if (!oauth) throw new Error("oauth_not_configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: canvaOAuthRedirectUri(),
  });
  return await postCanvaToken(oauth.clientId, oauth.clientSecret, body);
}

export async function revokeCanvaToken(token: string): Promise<boolean> {
  const oauth = readPlatformCanvaOAuth();
  if (!oauth || !token) return false;
  const res = await fetch(CANVA_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: canvaBasicAuth(oauth.clientId, oauth.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }).toString(),
  });
  return res.ok;
}

export async function getCanvaAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  const { data: row, error } = await admin
    .from("organization_canva_connection_tokens")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !row?.refresh_token_enc) throw new Error("canva_not_connected");

  const tokenRow = row as TokenRow;
  const expiresAt = tokenRow.access_token_expires_at
    ? new Date(tokenRow.access_token_expires_at).getTime()
    : 0;
  if (
    !options?.forceRefresh &&
    tokenRow.access_token_enc &&
    Number.isFinite(expiresAt) &&
    expiresAt - SKEW_MS > Date.now()
  ) {
    return await decryptCanvaToken(tokenRow.access_token_enc);
  }

  const oauth = readPlatformCanvaOAuth();
  if (!oauth) throw new Error("oauth_not_configured");
  const refreshToken = await decryptCanvaToken(tokenRow.refresh_token_enc);
  const tokenJson = await postCanvaToken(
    oauth.clientId,
    oauth.clientSecret,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );

  if (!tokenJson.access_token || !tokenJson.refresh_token) {
    const code = tokenJson.code || tokenJson.error || "refresh_failed";
    if (code === "invalid_grant") {
      const now = new Date().toISOString();
      await admin.from("organization_canva_connection_tokens").delete().eq("organization_id", organizationId);
      await admin
        .from("organization_canva_connections")
        .update({ is_active: false, last_error: "invalid_grant", updated_at: now })
        .eq("organization_id", organizationId);
    }
    throw new Error(code);
  }

  const now = new Date().toISOString();
  const expiresInSec = Number(tokenJson.expires_in ?? 14400);
  const refreshEnc = await encryptCanvaToken(tokenJson.refresh_token);
  const accessEnc = await encryptCanvaToken(tokenJson.access_token);
  const { data: saved } = await admin
    .from("organization_canva_connection_tokens")
    .update({
      refresh_token_enc: refreshEnc,
      access_token_enc: accessEnc,
      access_token_expires_at: new Date(Date.now() + Math.max(60, expiresInSec) * 1000).toISOString(),
      oauth_scopes: tokenJson.scope ?? null,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("refresh_token_enc", tokenRow.refresh_token_enc)
    .select("access_token_enc");

  if (saved && saved.length > 0) return tokenJson.access_token;

  const { data: latest } = await admin
    .from("organization_canva_connection_tokens")
    .select("access_token_enc")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (latest?.access_token_enc) return await decryptCanvaToken(String(latest.access_token_enc));
  throw new Error("canva_token_race");
}

async function postCanvaToken(
  clientId: string,
  clientSecret: string,
  body: URLSearchParams,
): Promise<CanvaTokenResponse> {
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: canvaBasicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as CanvaTokenResponse;
  if (!res.ok) {
    return {
      ...json,
      code: json.code || json.error || "token_exchange_failed",
      message: json.message || json.error_description || json.error || "token_exchange_failed",
    };
  }
  return json;
}
