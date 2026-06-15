export function normalizeXenditError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown Xendit error";
  }
}

export function parseXenditApiErrorBody(body: unknown): string {
  if (!body || typeof body !== "object") return "Xendit API error";
  const row = body as Record<string, unknown>;
  const errors = row.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors.map((e) => {
      if (e && typeof e === "object") {
        const item = e as Record<string, unknown>;
        return String(item.message ?? item.error_code ?? JSON.stringify(item));
      }
      return String(e);
    });
    return parts.join("; ");
  }
  const message = row.message ?? row.error_code ?? row.error;
  if (message != null) return String(message);
  return "Xendit API error";
}

export function formatXenditApiError(status: number, body: unknown): string {
  const parsed = parseXenditApiErrorBody(body);
  const row = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const code = row.error_code != null ? String(row.error_code) : "";
  const base = code ? `${parsed} (${code}, HTTP ${status})` : `${parsed} (HTTP ${status})`;
  const hint = xenditErrorHint(status, code, parsed);
  return hint ? `xendit_api: ${base}. ${hint}` : `xendit_api: ${base}`;
}

function xenditErrorHint(status: number, errorCode: string, message: string): string | null {
  const msg = message.toLowerCase();
  if (
    errorCode === "REQUEST_FORBIDDEN_ERROR" ||
    errorCode === "FEATURE_NOT_ACTIVATED" ||
    msg.includes("credentials are not valid") ||
    msg.includes("do not have necessary permissions")
  ) {
    return "Master secret key may be valid but xenPlatform/OWNED sub-accounts are not enabled. In Xendit Dashboard activate xenPlatform; for Indonesia request OWNED capability from help@xendit.co. Ensure API key has xenPlatform permissions (not a sub-account key).";
  }
  if (errorCode === "INVALID_API_KEY" || status === 401) {
    return "Check XENDIT_SECRET_KEY: use master account Secret key (xnd_development_ for test), no quotes/spaces, not the public key.";
  }
  if (errorCode === "API_KEY_ENVIRONMENT_NOT_MATCH") {
    return "Test key must be used with test accounts; live key with live. Align XENDIT_ENV with your key prefix.";
  }
  return null;
}
