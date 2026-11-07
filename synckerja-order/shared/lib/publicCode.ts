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

/** Outlet name as a URL piece: "Sate Sultan PIK" → "sate-sultan-pik". */
export function slugifyOutletName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Public path segment. The stored code stays 6 characters; the outlet name is only a prefix.
 * "Sate Sultan PIK" + "49eetd" → "sate-sultan-pik-49eetd".
 */
export function formatPublicOrderSegment(name: string | null | undefined, code: string): string {
  const normalized = normalizePublicCode(code);
  const slug = slugifyOutletName(name);
  if (!slug || !isValidPublicCode(normalized)) return normalized;
  if (slug === normalized || slug.endsWith(`-${normalized}`)) return slug;
  return `${slug}-${normalized}`;
}

const SLUGGED_CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*-([a-z0-9]{6})$/;

/** Accepts "49eetd" and "sate-sultan-pik-49eetd". Returns "" when the segment is not a store code. */
export function extractPublicCode(segment: string | null | undefined): string {
  const raw = normalizePublicCode(segment);
  if (isValidPublicCode(raw)) return raw;
  const match = SLUGGED_CODE.exec(raw);
  return match && isValidPublicCode(match[1]) ? match[1] : "";
}

export function isPublicOrderSegment(segment: string | null | undefined): boolean {
  return extractPublicCode(segment) !== "";
}
