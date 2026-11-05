/** Public carousel JPEG URLs on the verified synckerja.com host. */

export const CAROUSEL_STORAGE_BUCKET = "social-media-carousel";
export const CAROUSEL_PUBLISH_IMAGE_LIMIT = 10;
export const CAROUSEL_IMAGE_URL_TTL_SEC = 6 * 60 * 60;
export const TIKTOK_CAROUSEL_PUBLIC_ORIGIN = "https://office.synckerja.com";

const STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

export function isCarouselStoragePath(storagePath: string): boolean {
  return STORAGE_PATH_RE.test(storagePath.trim());
}

export function carouselMediaSnapshot(storagePaths: string[]): string {
  return storagePaths.map((path) => path.trim()).filter(Boolean).join("\n");
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function signCarouselImagePath(
  secret: string,
  storagePath: string,
  exp: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = new TextEncoder().encode(`${exp}.${storagePath}`);
  const signature = await crypto.subtle.sign("HMAC", key, payload);
  return bytesToHex(signature);
}

export function carouselImageExpiryOk(exp: number, nowSec: number): boolean {
  if (!Number.isFinite(exp) || !Number.isInteger(exp)) return false;
  if (exp < nowSec - 60) return false;
  if (exp > nowSec + CAROUSEL_IMAGE_URL_TTL_SEC + 120) return false;
  return true;
}

export async function buildTikTokCarouselImageUrl(args: {
  publicOrigin?: string;
  secret: string;
  storagePath: string;
  nowSec?: number;
}): Promise<string> {
  const storagePath = args.storagePath.trim();
  const secret = args.secret.trim();
  if (!secret) throw new Error("tiktok_carousel_url_secret_missing");
  if (!isCarouselStoragePath(storagePath)) throw new Error("invalid_carousel_path");
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = nowSec + CAROUSEL_IMAGE_URL_TTL_SEC;
  const sig = await signCarouselImagePath(secret, storagePath, exp);
  const origin = (args.publicOrigin?.trim() || TIKTOK_CAROUSEL_PUBLIC_ORIGIN).replace(/\/+$/, "");
  const encoded = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${origin}/api/tiktok-carousel/${encoded}?exp=${exp}&sig=${sig}`;
}

export type CarouselImageAuth =
  | { ok: true; storagePath: string }
  | { ok: false; status: number; error: string };

export async function authorizeCarouselImageRequest(args: {
  storagePath: string;
  expRaw: string;
  sig: string;
  secret: string;
  nowSec?: number;
}): Promise<CarouselImageAuth> {
  const storagePath = args.storagePath.trim();
  if (!isCarouselStoragePath(storagePath)) {
    return { ok: false, status: 400, error: "invalid_carousel_path" };
  }
  const secret = args.secret.trim();
  if (!secret) {
    return { ok: false, status: 500, error: "tiktok_carousel_url_secret_missing" };
  }
  const exp = Number(args.expRaw);
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000);
  if (!carouselImageExpiryOk(exp, nowSec)) {
    return { ok: false, status: 403, error: "carousel_url_expired" };
  }
  const expected = await signCarouselImagePath(secret, storagePath, exp);
  const actual = args.sig.trim().toLowerCase();
  if (!signaturesMatch(actual, expected)) {
    return { ok: false, status: 403, error: "carousel_url_signature" };
  }
  return { ok: true, storagePath };
}
