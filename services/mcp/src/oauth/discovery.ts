import { mcpResourceUrl, type McpServiceConfig } from "../config";
import { PHASE0_SCOPES } from "../scopes";

export function protectedResourceMetadata(config: McpServiceConfig) {
  return {
    resource: mcpResourceUrl(config),
    authorization_servers: [config.publicUrl],
    scopes_supported: [...PHASE0_SCOPES],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(config: McpServiceConfig) {
  return {
    issuer: config.publicUrl,
    authorization_endpoint: `${config.publicUrl}/authorize`,
    token_endpoint: `${config.publicUrl}/token`,
    registration_endpoint: `${config.publicUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...PHASE0_SCOPES],
  };
}
