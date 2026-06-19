/** Decode JWT payload and enforce Authenticator Assurance Level 2 (MFA verified). */

export type AalForbiddenResponse = Response;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function requireAal2FromBearer(
  authorization: string | null,
  json: (body: Record<string, unknown>, status: number) => Response,
): AalForbiddenResponse | null {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Missing authorization", code: "UNAUTHORIZED" }, 401);
  }

  const payload = decodeJwtPayload(token);
  const aal = payload?.aal;
  if (aal !== "aal2") {
    return json(
      {
        error: "Two-factor authentication required for this action",
        code: "MFA_REQUIRED",
      },
      403,
    );
  }

  return null;
}
