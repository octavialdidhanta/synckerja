import { SignJWT, jwtVerify } from "jose";

/**
 * Preview → confirm for a content brief edit.
 * The token carries the exact text the user was shown. Inventory tokens are a different type.
 */

export const CONTENT_CONFIRMATION_TTL_SECONDS = 15 * 60;
const CONFIRMATION_TYPE = "mcp_content_confirmation";

export type ContentConfirmableTool = "content.briefs.update" | "content.briefs.create" | "catalog.product.fields.update";

export type ContentConfirmationIdentity = { userId: string; organizationId: string };

export type SignedContentConfirmation = { confirm_token: string; expires_at: string };

export type VerifiedContentConfirmation = { confirmId: string; payload: Record<string, unknown> };

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(`${secret}:${CONFIRMATION_TYPE}`);
}

export async function signContentConfirmation(
  secret: string,
  identity: ContentConfirmationIdentity,
  tool: ContentConfirmableTool,
  payload: Record<string, unknown>,
  now: Date = new Date(),
): Promise<SignedContentConfirmation> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + CONTENT_CONFIRMATION_TTL_SECONDS;
  const token = await new SignJWT({ typ: CONFIRMATION_TYPE, tool, org: identity.organizationId, input: payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(signingKey(secret));
  return { confirm_token: token, expires_at: new Date(expiresAt * 1000).toISOString() };
}

/** Throws confirmation_invalid / confirmation_expired. A token for another tool, user, or org never verifies. */
export async function verifyContentConfirmation(
  secret: string,
  identity: ContentConfirmationIdentity,
  tool: ContentConfirmableTool,
  token: string,
  now: Date = new Date(),
): Promise<VerifiedContentConfirmation> {
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, signingKey(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ERR_JWT_EXPIRED") throw new Error("confirmation_expired");
    throw new Error("confirmation_invalid");
  }
  if (
    payload.typ !== CONFIRMATION_TYPE
    || payload.tool !== tool
    || payload.sub !== identity.userId
    || payload.org !== identity.organizationId
    || typeof payload.jti !== "string"
    || !payload.input
    || typeof payload.input !== "object"
  ) {
    throw new Error("confirmation_invalid");
  }
  return { confirmId: payload.jti, payload: payload.input as Record<string, unknown> };
}
