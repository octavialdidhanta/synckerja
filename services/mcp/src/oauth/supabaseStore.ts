import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthCodeRecord,
  ConsentIdentity,
  GrantStore,
  OAuthClientRecord,
  OAuthRequestRecord,
  RefreshTokenRecord,
} from "./store";

type RequestRow = {
  id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256";
  scope: string;
  state: string | null;
  resource: string | null;
  expires_at: string;
  user_id: string | null;
  profile_id: string | null;
  organization_id: string | null;
  employee_id: string | null;
};

type CodeRow = {
  code_hash: string;
  request_id: string;
  user_id: string;
  profile_id: string;
  organization_id: string;
  employee_id: string | null;
  scope: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: string;
  consumed_at: string | null;
};

type RefreshRow = {
  token_hash: string;
  user_id: string;
  profile_id: string;
  organization_id: string;
  employee_id: string | null;
  scope: string;
  client_id: string;
  expires_at: string;
  revoked_at: string | null;
};

function requestFromRow(row: RequestRow): OAuthRequestRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    scope: row.scope,
    state: row.state,
    resource: row.resource,
    expiresAt: row.expires_at,
    userId: row.user_id,
    profileId: row.profile_id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
  };
}

function codeFromRow(row: CodeRow): AuthCodeRecord {
  return {
    codeHash: row.code_hash,
    requestId: row.request_id,
    userId: row.user_id,
    profileId: row.profile_id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    scope: row.scope,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

function refreshFromRow(row: RefreshRow): RefreshTokenRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    profileId: row.profile_id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    scope: row.scope,
    clientId: row.client_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class SupabaseGrantStore implements GrantStore {
  constructor(private readonly admin: SupabaseClient) {}

  async insertClient(client: OAuthClientRecord): Promise<void> {
    const { error } = await this.admin.from("mcp_oauth_clients").insert({
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
    });
    if (error) throw new Error(error.message);
  }

  async findClient(clientId: string): Promise<OAuthClientRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_clients")
      .select("client_id, client_name, redirect_uris")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      clientId: data.client_id,
      clientName: data.client_name,
      redirectUris: data.redirect_uris ?? [],
    };
  }

  async insertRequest(request: OAuthRequestRecord): Promise<void> {
    const { error } = await this.admin.from("mcp_oauth_requests").insert({
      id: request.id,
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      code_challenge: request.codeChallenge,
      code_challenge_method: request.codeChallengeMethod,
      scope: request.scope,
      state: request.state,
      resource: request.resource,
      expires_at: request.expiresAt,
    });
    if (error) throw new Error(error.message);
  }

  async findRequest(id: string): Promise<OAuthRequestRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_requests")
      .select(
        "id, client_id, redirect_uri, code_challenge, code_challenge_method, scope, state, resource, expires_at, user_id, profile_id, organization_id, employee_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? requestFromRow(data as RequestRow) : null;
  }

  async claimRequest(
    id: string,
    identity: ConsentIdentity,
    nowIso: string,
  ): Promise<OAuthRequestRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_requests")
      .update({
        user_id: identity.userId,
        profile_id: identity.profileId,
        organization_id: identity.organizationId,
        employee_id: identity.employeeId,
      })
      .eq("id", id)
      .is("user_id", null)
      .gt("expires_at", nowIso)
      .select(
        "id, client_id, redirect_uri, code_challenge, code_challenge_method, scope, state, resource, expires_at, user_id, profile_id, organization_id, employee_id",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? requestFromRow(data as RequestRow) : null;
  }

  async insertCode(code: AuthCodeRecord): Promise<void> {
    const { error } = await this.admin.from("mcp_oauth_codes").insert({
      code_hash: code.codeHash,
      request_id: code.requestId,
      user_id: code.userId,
      profile_id: code.profileId,
      organization_id: code.organizationId,
      employee_id: code.employeeId,
      scope: code.scope,
      client_id: code.clientId,
      redirect_uri: code.redirectUri,
      code_challenge: code.codeChallenge,
      expires_at: code.expiresAt,
    });
    if (error) throw new Error(error.message);
  }

  async findCode(codeHash: string): Promise<AuthCodeRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_codes")
      .select(
        "code_hash, request_id, user_id, profile_id, organization_id, employee_id, scope, client_id, redirect_uri, code_challenge, expires_at, consumed_at",
      )
      .eq("code_hash", codeHash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? codeFromRow(data as CodeRow) : null;
  }

  async consumeCode(codeHash: string, consumedAt: string): Promise<AuthCodeRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_codes")
      .update({ consumed_at: consumedAt })
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .select(
        "code_hash, request_id, user_id, profile_id, organization_id, employee_id, scope, client_id, redirect_uri, code_challenge, expires_at, consumed_at",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? codeFromRow(data as CodeRow) : null;
  }

  async insertRefresh(token: RefreshTokenRecord): Promise<void> {
    const { error } = await this.admin.from("mcp_oauth_refresh_tokens").insert({
      token_hash: token.tokenHash,
      user_id: token.userId,
      profile_id: token.profileId,
      organization_id: token.organizationId,
      employee_id: token.employeeId,
      scope: token.scope,
      client_id: token.clientId,
      expires_at: token.expiresAt,
    });
    if (error) throw new Error(error.message);
  }

  async findRefresh(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_refresh_tokens")
      .select(
        "token_hash, user_id, profile_id, organization_id, employee_id, scope, client_id, expires_at, revoked_at",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? refreshFromRow(data as RefreshRow) : null;
  }

  async revokeRefresh(tokenHash: string, revokedAt: string): Promise<RefreshTokenRecord | null> {
    const { data, error } = await this.admin
      .from("mcp_oauth_refresh_tokens")
      .update({ revoked_at: revokedAt })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .select(
        "token_hash, user_id, profile_id, organization_id, employee_id, scope, client_id, expires_at, revoked_at",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? refreshFromRow(data as RefreshRow) : null;
  }
}
