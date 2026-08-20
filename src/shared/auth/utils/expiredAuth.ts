export function isExpiredAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as { message?: unknown; code?: unknown; status?: unknown };
  const message = String(rec.message ?? "").toLowerCase();
  const code = String(rec.code ?? "").toLowerCase();
  if (code === "bad_jwt" || code === "pgrst303") return true;
  if (rec.status === 403 && (message.includes("jwt") || message.includes("expired"))) return true;
  return (
    message.includes("jwt expired") ||
    message.includes("token is expired") ||
    message.includes("bad_jwt") ||
    message.includes("invalid jwt") ||
    message.includes("invalid claims") ||
    message.includes("pgrst303")
  );
}

export function isSessionAccessTokenExpired(
  session: { expires_at?: number | null } | null | undefined,
  nowMs = Date.now(),
): boolean {
  const expiresAt = session?.expires_at;
  if (expiresAt == null || !Number.isFinite(Number(expiresAt))) return false;
  return Number(expiresAt) * 1000 <= nowMs;
}
