import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptGoogleContactsToken,
  encryptGoogleContactsToken,
} from "./googleContactsConfigCrypto.ts";
import { readPlatformGoogleContactsOAuth } from "./googleContactsAuth.ts";

export type GoogleContactsAccess = {
  accessToken: string;
  organizationId: string;
};

export async function getGoogleContactsAccessToken(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GoogleContactsAccess | null> {
  const platform = readPlatformGoogleContactsOAuth();
  if (!platform) return null;

  const { data: connection } = await admin
    .from("organization_google_contacts_connections")
    .select("organization_id, is_active, oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!connection?.oauth_connected_at || !connection.is_active) return null;

  const { data: tokenRow } = await admin
    .from("organization_google_contacts_connection_tokens")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!tokenRow?.refresh_token_enc) return null;

  const expiresAt = tokenRow.access_token_expires_at
    ? new Date(String(tokenRow.access_token_expires_at)).getTime()
    : 0;
  const skewMs = 60_000;

  if (tokenRow.access_token_enc && Number.isFinite(expiresAt) && expiresAt - skewMs > Date.now()) {
    try {
      const accessToken = await decryptGoogleContactsToken(String(tokenRow.access_token_enc));
      return { accessToken, organizationId };
    } catch {
      // refresh below
    }
  }

  const refreshToken = await decryptGoogleContactsToken(String(tokenRow.refresh_token_enc));
  const body = new URLSearchParams({
    client_id: platform.clientId,
    client_secret: platform.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg = tokenJson.error_description ?? tokenJson.error ?? "token_refresh_failed";
    throw new Error(msg);
  }

  const accessEnc = await encryptGoogleContactsToken(tokenJson.access_token);
  const expiresInSec = Number(tokenJson.expires_in ?? 3600);
  const accessExpiresAt = new Date(Date.now() + Math.max(60, expiresInSec) * 1000).toISOString();
  const patch: Record<string, unknown> = {
    access_token_enc: accessEnc,
    access_token_expires_at: accessExpiresAt,
    updated_at: new Date().toISOString(),
  };
  if (tokenJson.refresh_token) {
    patch.refresh_token_enc = await encryptGoogleContactsToken(tokenJson.refresh_token);
  }

  await admin
    .from("organization_google_contacts_connection_tokens")
    .update(patch)
    .eq("organization_id", organizationId);

  return { accessToken: tokenJson.access_token, organizationId };
}
