const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Minimum backup codes issued per user (enroll + regenerate). */
export const MIN_RECOVERY_CODE_COUNT = 8;

export const DEFAULT_RECOVERY_CODE_COUNT = MIN_RECOVERY_CODE_COUNT;

export function generateRecoveryCodes(count = DEFAULT_RECOVERY_CODE_COUNT): string[] {
  const safeCount = Math.max(MIN_RECOVERY_CODE_COUNT, Math.floor(count));
  const codes: string[] = [];
  const seen = new Set<string>();
  while (codes.length < safeCount) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      codes.push(formatted);
    }
  }
  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
