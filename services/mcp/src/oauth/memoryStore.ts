import type {
  AuthCodeRecord,
  ConnectorSessionRecord,
  ConsentIdentity,
  GrantStore,
  OAuthClientRecord,
  OAuthRequestRecord,
  RefreshTokenRecord,
} from "./store";

export function connectorSessionKey(userId: string, clientId: string): string {
  return `${userId}\0${clientId}`;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryGrantStore implements GrantStore {
  readonly clients = new Map<string, OAuthClientRecord>();
  readonly requests = new Map<string, OAuthRequestRecord>();
  readonly codes = new Map<string, AuthCodeRecord>();
  readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  readonly sessions = new Map<string, ConnectorSessionRecord>();

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

  async supersedeOlderConnections(userId: string, organizationId: string, keepClientId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const row of this.refreshTokens.values()) {
      if (row.userId !== userId || row.organizationId !== organizationId || row.revokedAt) continue;
      if (row.clientId === keepClientId) continue;
      row.revokedAt = now;
    }
  }

  async findConnectorSession(userId: string, clientId: string): Promise<ConnectorSessionRecord | null> {
    const row = this.sessions.get(connectorSessionKey(userId, clientId));
    return row ? copy(row) : null;
  }

  async ensureConnectorSession(session: ConnectorSessionRecord): Promise<ConnectorSessionRecord> {
    const key = connectorSessionKey(session.userId, session.clientId);
    const existing = this.sessions.get(key);
    if (existing) return copy(existing);
    this.sessions.set(key, copy(session));
    return copy(session);
  }

  async upsertConnectorSession(session: ConnectorSessionRecord): Promise<ConnectorSessionRecord> {
    const key = connectorSessionKey(session.userId, session.clientId);
    const existing = this.sessions.get(key);
    const next: ConnectorSessionRecord = {
      userId: session.userId,
      clientId: session.clientId,
      connectionId: existing?.connectionId ?? session.connectionId,
      activeOrganizationId: session.activeOrganizationId,
    };
    this.sessions.set(key, copy(next));
    return copy(next);
  }
}
