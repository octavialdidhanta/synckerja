export type OAuthClientRecord = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

export type OAuthRequestRecord = {
  id: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  state: string | null;
  resource: string | null;
  expiresAt: string;
  userId: string | null;
  profileId: string | null;
  organizationId: string | null;
  employeeId: string | null;
};

export type AuthCodeRecord = {
  codeHash: string;
  requestId: string;
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  scope: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type RefreshTokenRecord = {
  tokenHash: string;
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  scope: string;
  clientId: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type ConsentIdentity = {
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
};

export interface GrantStore {
  insertClient(client: OAuthClientRecord): Promise<void>;
  findClient(clientId: string): Promise<OAuthClientRecord | null>;
  insertRequest(request: OAuthRequestRecord): Promise<void>;
  findRequest(id: string): Promise<OAuthRequestRecord | null>;
  claimRequest(id: string, identity: ConsentIdentity, nowIso: string): Promise<OAuthRequestRecord | null>;
  insertCode(code: AuthCodeRecord): Promise<void>;
  findCode(codeHash: string): Promise<AuthCodeRecord | null>;
  consumeCode(codeHash: string, consumedAt: string): Promise<AuthCodeRecord | null>;
  insertRefresh(token: RefreshTokenRecord): Promise<void>;
  findRefresh(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefresh(tokenHash: string, revokedAt: string): Promise<RefreshTokenRecord | null>;
}
