import { mcpResourceUrl, type McpServiceConfig } from "../config";
import { formatScope, parseRequestedScope } from "../scopes";
import { OAuthError } from "./errors";
import type { GrantStore } from "./store";

const REQUEST_TTL_MS = 10 * 60 * 1000;

export async function beginAuthorization(
  config: McpServiceConfig,
  store: GrantStore,
  query: URLSearchParams,
  now: Date,
): Promise<string> {
  const clientId = query.get("client_id") || "";
  const redirectUri = query.get("redirect_uri") || "";
  const responseType = query.get("response_type") || "";
  const challenge = query.get("code_challenge") || "";
  const method = query.get("code_challenge_method") || "";
  const resource = query.get("resource");

  const client = clientId ? await store.findClient(clientId) : null;
  if (!client) {
    throw new OAuthError("invalid_client", "Unknown client_id", 400);
  }
  if (!client.redirectUris.includes(redirectUri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uri is not registered", 400);
  }
  if (responseType !== "code") {
    throw new OAuthError("unsupported_response_type", "response_type must be code", 400);
  }
  if (!challenge || method !== "S256") {
    throw new OAuthError("invalid_request", "PKCE S256 is required", 400);
  }
  const scopes = parseRequestedScope(query.get("scope"));
  if (!scopes) {
    throw new OAuthError("invalid_scope", "Unknown scope", 400);
  }
  if (resource && resource !== mcpResourceUrl(config) && resource !== config.publicUrl) {
    throw new OAuthError("invalid_target", "resource does not match this server", 400);
  }

  const id = crypto.randomUUID();
  await store.insertRequest({
    id,
    clientId,
    redirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    scope: formatScope(scopes),
    state: query.get("state"),
    resource,
    expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
    userId: null,
    profileId: null,
    organizationId: null,
    employeeId: null,
  });

  const consent = new URL("/oauth/consent", config.officeOrigin);
  consent.searchParams.set("request", id);
  return consent.toString();
}
