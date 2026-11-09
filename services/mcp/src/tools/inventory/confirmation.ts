import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

/**
 * Preview → confirm for inventory writes.
 *
 * A preview tool signs the exact, validated input into a short-lived token. The matching
 * write tool accepts only that token, so what gets saved is exactly what the user saw.
 * The token's jti is stored by the database write (mcp_tool_confirmations), so a token
 * cannot be used twice.
 */

export const CONFIRMATION_TTL_SECONDS = 15 * 60;
const CONFIRMATION_TYPE = "mcp_inventory_confirmation";

export type ConfirmableTool =
  | "inventory.ingredient.create"
  | "inventory.purchase_order.create"
  | "inventory.production.create";

export type ConfirmationIdentity = { userId: string; organizationId: string };

export type SignedConfirmation = { confirm_token: string; expires_at: string };

export type VerifiedConfirmation = { confirmId: string; payload: Record<string, unknown> };

export const confirmInput = z.object({
  confirm_token: z.string().trim().min(20).max(4000),
}).strict();

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(`${secret}:${CONFIRMATION_TYPE}`);
}

export async function signConfirmation(
  secret: string,
  identity: ConfirmationIdentity,
  tool: ConfirmableTool,
  payload: Record<string, unknown>,
  now: Date = new Date(),
): Promise<SignedConfirmation> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + CONFIRMATION_TTL_SECONDS;
  const token = await new SignJWT({ typ: CONFIRMATION_TYPE, tool, org: identity.organizationId, input: payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(signingKey(secret));
  return { confirm_token: token, expires_at: new Date(expiresAt * 1000).toISOString() };
}

/** Throws confirmation_invalid / confirmation_expired; never returns a token for another tool, user, or org. */
export async function verifyConfirmation(
  secret: string,
  identity: ConfirmationIdentity,
  tool: ConfirmableTool,
  token: string,
  now: Date = new Date(),
): Promise<VerifiedConfirmation> {
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
