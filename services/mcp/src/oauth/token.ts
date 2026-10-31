import type { McpServiceConfig } from "../config";
import { pkceMatches, sha256Hex } from "./pkce";
import { OAuthError } from "./errors";
import { issueTokenPair, type IssuedTokens } from "./tokens";
import type { GrantStore } from "./store";

export async function exchangeToken(
  config: McpServiceConfig,
  store: GrantStore,
  params: Record<string, string>,
  now: Date,
): Promise<IssuedTokens> {
  const grantType = params.grant_type || "";
  const clientId = params.client_id || "";
  const client = clientId ? await store.findClient(clientId) : null;
  if (!client) {
    throw new OAuthError("invalid_client", "Unknown client_id", 401);
  }

  if (grantType === "authorization_code") {
    return exchangeCode(config, store, clientId, params, now);
  }
  if (grantType === "refresh_token") {
    return exchangeRefresh(config, store, clientId, params, now);
  }
  throw new OAuthError("unsupported_grant_type", "Unsupported grant_type", 400);
}

async function exchangeCode(
  config: McpServiceConfig,
  store: GrantStore,
  clientId: string,
  params: Record<string, string>,
  now: Date,
): Promise<IssuedTokens> {
  const code = params.code || "";
  const verifier = params.code_verifier || "";
  const redirectUri = params.redirect_uri || "";
  if (!code || !verifier || !redirectUri) {
    throw new OAuthError("invalid_request", "code, redirect_uri, and code_verifier are required", 400);
  }

  const row = await store.findCode(sha256Hex(code));
  if (!row || row.consumedAt || row.expiresAt <= now.toISOString()) {
    throw new OAuthError("invalid_grant", "Authorization code is invalid", 400);
  }
  if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
    throw new OAuthError("invalid_grant", "Authorization code is invalid", 400);
  }

  const verifierOk = pkceMatches(verifier, row.codeChallenge);
  const consumed = await store.consumeCode(row.codeHash, now.toISOString());
  if (!consumed || !verifierOk) {
    throw new OAuthError("invalid_grant", "PKCE verification failed", 400);
  }

  return issueTokenPair(
    config,
    store,
    {
      userId: row.userId,
      profileId: row.profileId,
      organizationId: row.organizationId,
      employeeId: row.employeeId,
      scope: row.scope,
      clientId: row.clientId,
    },
    now,
  );
}

async function exchangeRefresh(
  config: McpServiceConfig,
  store: GrantStore,
  clientId: string,
  params: Record<string, string>,
  now: Date,
): Promise<IssuedTokens> {
  const refreshToken = params.refresh_token || "";
  if (!refreshToken) {
    throw new OAuthError("invalid_request", "refresh_token is required", 400);
  }
  const row = await store.findRefresh(sha256Hex(refreshToken));
  if (!row || row.revokedAt || row.expiresAt <= now.toISOString() || row.clientId !== clientId) {
    throw new OAuthError("invalid_grant", "Refresh token is invalid", 400);
  }
  const revoked = await store.revokeRefresh(row.tokenHash, now.toISOString());
  if (!revoked) {
    throw new OAuthError("invalid_grant", "Refresh token is invalid", 400);
  }
  return issueTokenPair(
    config,
    store,
    {
      userId: row.userId,
      profileId: row.profileId,
      organizationId: row.organizationId,
      employeeId: row.employeeId,
      scope: row.scope,
      clientId: row.clientId,
    },
    now,
  );
}
