export const PUBLIC_CODE_LENGTH = 6;
export const PUBLIC_CODE_PATTERN = /^[a-z0-9]{6}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function isValidPublicCode(value: string | null | undefined): boolean {
  return PUBLIC_CODE_PATTERN.test((value ?? "").trim());
}

export function normalizePublicCode(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function generatePublicCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < PUBLIC_CODE_LENGTH; i += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "a";
  }
  return out;
}
