/** Normalize secret pasted from dashboard / CLI (trim, quotes, accidental Basic/Bearer prefix). */
export function normalizeXenditSecretKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.toLowerCase().startsWith("basic ")) {
    key = key.slice(6).trim();
  }
  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }
  return key;
}

export type XenditKeyKind = "development" | "production" | "public" | "unknown";

export function detectXenditKeyKind(secretKey: string): XenditKeyKind {
  if (secretKey.startsWith("xnd_development_")) return "development";
  if (secretKey.startsWith("xnd_production_")) return "production";
  if (secretKey.startsWith("xnd_public_")) return "public";
  return "unknown";
}

export function xenditBasicAuthHeader(secretKey: string): string {
  const normalized = normalizeXenditSecretKey(secretKey);
  const credentials = `${normalized}:`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}
