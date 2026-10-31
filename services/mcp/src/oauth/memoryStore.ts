import type {
  AuthCodeRecord,
  ConsentIdentity,
  GrantStore,
  OAuthClientRecord,
  OAuthRequestRecord,
  RefreshTokenRecord,
} from "./store";

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryGrantStore implements GrantStore {
  readonly clients = new Map<string, OAuthClientRecord>();
  readonly requests = new Map<string, OAuthRequestRecord>();
  readonly codes = new Map<string, AuthCodeRecord>();
  readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  async insertClient(client: OAuthClientRecord): Promise<void> {
    this.clients.set(client.clientId, copy(client));
  }

  async findClient(clientId: string): Promise<OAuthClientRecord | null> {
    const row = this.clients.get(clientId);
    return row ? copy(row) : null;
  }

  async insertRequest(request: OAuthRequestRecord): Promise<void> {
    this.requests.set(request.id, copy(request));
  }

  async findRequest(id: string): Promise<OAuthRequestRecord | null> {
    const row = this.requests.get(id);
    return row ? copy(row) : null;
  }

  async claimRequest(
    id: string,
    identity: ConsentIdentity,
    nowIso: string,
  ): Promise<OAuthRequestRecord | null> {
    const row = this.requests.get(id);
    if (!row || row.userId) return null;
    if (row.expiresAt <= nowIso) return null;
    row.userId = identity.userId;
    row.profileId = identity.profileId;
    row.organizationId = identity.organizationId;
    row.employeeId = identity.employeeId;
    return copy(row);
  }

  async insertCode(code: AuthCodeRecord): Promise<void> {
    this.codes.set(code.codeHash, copy(code));
  }

  async findCode(codeHash: string): Promise<AuthCodeRecord | null> {
    const row = this.codes.get(codeHash);
    return row ? copy(row) : null;
  }

  async consumeCode(codeHash: string, consumedAt: string): Promise<AuthCodeRecord | null> {
    const row = this.codes.get(codeHash);
    if (!row || row.consumedAt) return null;
    row.consumedAt = consumedAt;
    return copy(row);
  }

  async insertRefresh(token: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(token.tokenHash, copy(token));
  }

  async findRefresh(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = this.refreshTokens.get(tokenHash);
    return row ? copy(row) : null;
  }

  async revokeRefresh(tokenHash: string, revokedAt: string): Promise<RefreshTokenRecord | null> {
    const row = this.refreshTokens.get(tokenHash);
    if (!row || row.revokedAt) return null;
    row.revokedAt = revokedAt;
    return copy(row);
  }
}
