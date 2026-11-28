import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

/**
 * Preview → confirm for footage writes.
 * The token carries only the preview id. The batch itself stays in mcp_footage_previews,
 * because a few dozen scene rows do not fit in the 4000-character inventory token.
 */

export const FOOTAGE_CONFIRM_NEXT_STEP =
  "Nothing is saved yet. Show every before and after field in this summary to the user and ask them to confirm this one write. "
  + "Call the matching save tool with this confirm_token only after they clearly say yes to this summary. "
  + "One yes confirms the writes shown together in that one message; a write that was not shown needs its own preview and yes.";

export const FOOTAGE_ALREADY_LOGGED_NEXT_STEP =
  "This use is already logged. Nothing was saved and no confirm_token was issued. Do not call footage.usage.log.";

const CONFIRMATION_TYPE = "mcp_footage_confirmation";
const PREVIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FootageConfirmableTool =
  | "footage.scenes.upsert_batch"
  | "footage.usage.log"
  | "footage.move"
  | "footage.ban.add"
  | "footage.clips.upsert"
  | "footage.clips.create"
  | "footage.delete"
  | "footage.restore"
  | "catalog.media.delete"
  | "catalog.media.restore"
  | "catalog.style.update"
  | "catalog.reference.upsert"
  | "catalog.shotlist.upsert"
  | "catalog.claims.upsert"
  | "render.jobs.create";

export type FootageConfirmationIdentity = { userId: string; organizationId: string };

export type SignedFootageConfirmation = { confirm_token: string; expires_at: string };

export type VerifiedFootageConfirmation = { previewId: string };

export const confirmFootageInput = z.object({
  confirm_token: z.string().trim().min(20).max(4000),
}).strict();

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(`${secret}:${CONFIRMATION_TYPE}`);
}

export async function signFootageConfirmation(
  secret: string,
  identity: FootageConfirmationIdentity,
  tool: FootageConfirmableTool,
  previewId: string,
  expiresAt: string,
): Promise<SignedFootageConfirmation> {
  const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
  if (!PREVIEW_ID.test(previewId) || !Number.isFinite(exp)) throw new Error("confirmation_invalid");
  const token = await new SignJWT({
    typ: CONFIRMATION_TYPE,
    tool,
    org: identity.organizationId,
    preview_id: previewId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.userId)
    .setJti(previewId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(signingKey(secret));
  return { confirm_token: token, expires_at: new Date(exp * 1000).toISOString() };
}

/** Throws confirmation_invalid / confirmation_expired. A token for another tool, user, or org never verifies. */
export async function verifyFootageConfirmation(
  secret: string,
  identity: FootageConfirmationIdentity,
  tool: FootageConfirmableTool,
  token: string,
  now: Date = new Date(),
): Promise<VerifiedFootageConfirmation> {
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
    || typeof payload.preview_id !== "string"
    || payload.jti !== payload.preview_id
    || !PREVIEW_ID.test(payload.preview_id)
  ) {
    throw new Error("confirmation_invalid");
  }
  return { previewId: payload.preview_id };
}
