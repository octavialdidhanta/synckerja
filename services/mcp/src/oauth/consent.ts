import { randomToken, sha256Hex } from "./pkce";
import { OAuthError } from "./errors";
import type { GrantStore } from "./store";

const CODE_TTL_MS = 5 * 60 * 1000;

export type ConsentDeps = {
  store: GrantStore;
  isActiveMember: (userId: string, organizationId: string) => Promise<boolean>;
  loadIdentity: (
    userId: string,
    organizationId: string,
  ) => Promise<{ profileId: string; employeeId: string | null } | null>;
  now: () => Date;
};

export async function completeConsent(
  input: { requestId: string; userId: string; organizationId: string },
  deps: ConsentDeps,
): Promise<{ redirect_url: string }> {
  const now = deps.now();
  const member = await deps.isActiveMember(input.userId, input.organizationId);
  if (!member) {
    throw new OAuthError("access_denied", "You are not an active member of that organization", 403);
  }
  const identity = await deps.loadIdentity(input.userId, input.organizationId);
  if (!identity) {
    throw new OAuthError("access_denied", "Profile was not found", 403);
  }

  const claimed = await deps.store.claimRequest(
    input.requestId,
    {
      userId: input.userId,
      profileId: identity.profileId,
      organizationId: input.organizationId,
      employeeId: identity.employeeId,
    },
    now.toISOString(),
  );
  if (!claimed) {
    throw new OAuthError("invalid_request", "Authorization request is missing or expired", 400);
  }

  const code = randomToken();
  await deps.store.insertCode({
    codeHash: sha256Hex(code),
    requestId: claimed.id,
    userId: input.userId,
    profileId: identity.profileId,
    organizationId: input.organizationId,
    employeeId: identity.employeeId,
    scope: claimed.scope,
    clientId: claimed.clientId,
    redirectUri: claimed.redirectUri,
    codeChallenge: claimed.codeChallenge,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    consumedAt: null,
  });

  const redirect = new URL(claimed.redirectUri);
  redirect.searchParams.set("code", code);
  if (claimed.state) redirect.searchParams.set("state", claimed.state);
  return { redirect_url: redirect.toString() };
}
