import { randomToken } from "./pkce";
import { OAuthError } from "./errors";
import type { GrantStore } from "./store";

export async function registerClient(
  store: GrantStore,
  body: {
    client_name?: unknown;
    redirect_uris?: unknown;
    token_endpoint_auth_method?: unknown;
  },
): Promise<{
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: ["authorization_code", "refresh_token"];
  response_types: ["code"];
}> {
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "MCP client";
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris is required", 400);
  }
  const redirectUris = body.redirect_uris.filter((uri): uri is string => typeof uri === "string" && uri.length > 0);
  if (redirectUris.length !== body.redirect_uris.length) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris must be strings", 400);
  }
  for (const uri of redirectUris) {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new OAuthError("invalid_redirect_uri", "redirect_uri must be an absolute URL", 400);
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new OAuthError("invalid_redirect_uri", "redirect_uri must be https or localhost", 400);
    }
  }
  if (
    body.token_endpoint_auth_method != null &&
    body.token_endpoint_auth_method !== "none"
  ) {
    throw new OAuthError("invalid_client_metadata", "Only public clients are supported", 400);
  }

  const clientId = `mcp_${randomToken(16)}`;
  await store.insertClient({ clientId, clientName: name, redirectUris });
  return {
    client_id: clientId,
    client_name: name,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}
