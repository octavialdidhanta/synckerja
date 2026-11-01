import { SignJWT, jwtVerify } from "jose";
import type { McpServiceConfig } from "../config";
import { mcpResourceUrl } from "../config";
import { randomToken, sha256Hex } from "./pkce";
import type { GrantStore, RefreshTokenRecord } from "./store";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AccessClaims = {
  sub: string;
  profileId: string;
  orgId: string | null;
  employeeId: string | null;
  connectionId: string | null;
  scopes: string[];
  clientId: string;
  jti: string;
  iat: number;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

type Identity = {
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  scope: string;
  clientId: string;
  /** Present on tokens issued after connector sessions. Legacy tokens keep organizationId in the JWT instead. */
  connectionId?: string;
};

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(config: McpServiceConfig, identity: Identity): Promise<string> {
  const claims = identity.connectionId
    ? {
        profile_id: identity.profileId,
        connection_id: identity.connectionId,
        scope: identity.scope,
        client_id: identity.clientId,
      }
    : {
        profile_id: identity.profileId,
        org_id: identity.organizationId,
        employee_id: identity.employeeId,
        scope: identity.scope,
        client_id: identity.clientId,
      };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.userId)
    .setIssuer(config.publicUrl)
    .setAudience(mcpResourceUrl(config))
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(signingKey(config.jwtSecret));
}

export async function verifyAccessToken(
  config: McpServiceConfig,
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(config.jwtSecret), {
      issuer: config.publicUrl,
      audience: mcpResourceUrl(config),
    });
    if (!payload.sub || typeof payload.profile_id !== "string") return null;
    const connectionId = typeof payload.connection_id === "string" ? payload.connection_id : null;
    const orgId = typeof payload.org_id === "string" ? payload.org_id : null;
    if (!connectionId && !orgId) return null;
    if (typeof payload.scope !== "string" || typeof payload.client_id !== "string" || typeof payload.jti !== "string") {
      return null;
    }
    if (typeof payload.iat !== "number") return null;
    const employeeId = payload.employee_id;
    return {
      sub: payload.sub,
      profileId: payload.profile_id,
      orgId,
      employeeId: typeof employeeId === "string" ? employeeId : null,
      connectionId,
      scopes: payload.scope.split(/\s+/).filter(Boolean),
      clientId: payload.client_id,
      jti: payload.jti,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export async function issueTokenPair(
  config: McpServiceConfig,
  store: GrantStore,
  identity: Identity & { connectionId: string },
  now: Date,
): Promise<IssuedTokens> {
  const refreshToken = randomToken();
  const record: RefreshTokenRecord = {
    tokenHash: sha256Hex(refreshToken),
    userId: identity.userId,
    profileId: identity.profileId,
    organizationId: identity.organizationId,
    employeeId: identity.employeeId,
    connectionId: identity.connectionId,
    scope: identity.scope,
    clientId: identity.clientId,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    revokedAt: null,
  };
  await store.insertRefresh(record);
  const accessToken = await signAccessToken(config, identity);
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scope: identity.scope,
  };
}
