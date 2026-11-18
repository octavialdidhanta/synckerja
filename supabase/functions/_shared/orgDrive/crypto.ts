/**
 * AES-256-GCM for per-org Google Drive OAuth tokens.
 * Key: GOOGLE_DRIVE_ORG_ENCRYPTION_KEY, falling back to the keys already used for
 * per-org Google Contacts / Google Ads tokens, so no new secret is required to deploy.
 */

const ALGO = "AES-GCM";
const IV_LEN = 12;
const TAG_LEN = 128;

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("org_drive_encryption_key_missing");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  const bin = atob(trimmed);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("org_drive_encryption_key_invalid");
  return bytes;
}

export function orgDriveEncryptionKeyRaw(
  env: (name: string) => string | undefined = (n) => Deno.env.get(n),
): string {
  return (
    env("GOOGLE_DRIVE_ORG_ENCRYPTION_KEY")?.trim() ||
    env("GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY")?.trim() ||
    env("GOOGLE_ADS_CONFIG_ENCRYPTION_KEY")?.trim() ||
    ""
  );
}

export function isOrgDriveEncryptionReady(): boolean {
  try {
    decodeKey(orgDriveEncryptionKeyRaw());
    return true;
  } catch {
    return false;
  }
}

async function importKey(usage: "encrypt" | "decrypt", raw?: string): Promise<CryptoKey> {
  const bytes = decodeKey(raw ?? orgDriveEncryptionKeyRaw());
  return crypto.subtle.importKey("raw", new Uint8Array(bytes).buffer as ArrayBuffer, { name: ALGO }, false, [
    usage,
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function encryptOrgDriveToken(plaintext: string, rawKey?: string): Promise<string> {
  const key = await importKey("encrypt", rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const enc = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGO, iv, tagLength: TAG_LEN }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + enc.length);
  combined.set(iv, 0);
  combined.set(enc, iv.length);
  return toBase64(combined);
}

export async function decryptOrgDriveToken(ciphertextB64: string, rawKey?: string): Promise<string> {
  const key = await importKey("decrypt", rawKey);
  const combined = Uint8Array.from(atob(ciphertextB64.trim()), (c) => c.charCodeAt(0));
  if (combined.length < IV_LEN + 16) throw new Error("org_drive_token_invalid");
  const dec = await crypto.subtle.decrypt(
    { name: ALGO, iv: combined.slice(0, IV_LEN), tagLength: TAG_LEN },
    key,
    combined.slice(IV_LEN),
  );
  return new TextDecoder().decode(dec);
}
