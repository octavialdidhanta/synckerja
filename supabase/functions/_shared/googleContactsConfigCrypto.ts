/**
 * AES-256-GCM encrypt/decrypt for per-org Google Contacts OAuth tokens.
 * Key: GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY, fallback GOOGLE_ADS_CONFIG_ENCRYPTION_KEY.
 */

const ALGO = "AES-GCM";
const IV_LEN = 12;
const TAG_LEN = 128;

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  const bin = atob(trimmed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error("GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex)");
  }
  return bytes;
}

function getKeyBytes(): Uint8Array {
  const raw =
    Deno.env.get("GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY")?.trim() ||
    Deno.env.get("GOOGLE_ADS_CONFIG_ENCRYPTION_KEY")?.trim() ||
    "";
  return decodeKey(raw);
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptGoogleContactsToken(plaintext: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, ["encrypt"]);
  const enc = await crypto.subtle.encrypt(
    { name: ALGO, iv, tagLength: TAG_LEN },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + enc.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(enc), iv.length);
  return toBase64(combined);
}

export async function decryptGoogleContactsToken(ciphertextB64: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const combined = fromBase64(ciphertextB64.trim());
  if (combined.length < IV_LEN + 16) throw new Error("Invalid encrypted token payload");
  const iv = combined.slice(0, IV_LEN);
  const data = combined.slice(IV_LEN);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: ALGO, iv, tagLength: TAG_LEN }, key, data);
  return new TextDecoder().decode(dec);
}
