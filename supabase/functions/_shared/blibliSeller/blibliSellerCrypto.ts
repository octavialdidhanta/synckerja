/**
 * AES-256-GCM for Blibli seller API keys.
 * Key: BLIBLI_SELLER_CONFIG_ENCRYPTION_KEY (fallback TIKTOK_SHOP / TIKTOK_ADS encryption keys).
 */

const ALGO = "AES-GCM";
const IV_LEN = 12;
const TAG_LEN = 128;

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Encryption key is not set");
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
    throw new Error("Encryption key must be 32 bytes (base64 or 64-char hex)");
  }
  return bytes;
}

function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get("BLIBLI_SELLER_CONFIG_ENCRYPTION_KEY")?.trim() ??
    Deno.env.get("TIKTOK_SHOP_CONFIG_ENCRYPTION_KEY")?.trim() ??
    Deno.env.get("TIKTOK_ADS_CONFIG_ENCRYPTION_KEY") ?? "";
  return decodeKey(raw);
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encrypt(plaintext: string): Promise<string> {
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

async function decrypt(ciphertextB64: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const combined = fromBase64(ciphertextB64.trim());
  if (combined.length < IV_LEN + 16) throw new Error("Invalid encrypted payload");
  const iv = combined.slice(0, IV_LEN);
  const data = combined.slice(IV_LEN);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: ALGO, iv, tagLength: TAG_LEN }, key, data);
  return new TextDecoder().decode(dec);
}

export async function encryptBlibliSecret(plaintext: string): Promise<string> {
  return encrypt(plaintext);
}

export async function decryptBlibliSecret(ciphertextB64: string): Promise<string> {
  return decrypt(ciphertextB64);
}
