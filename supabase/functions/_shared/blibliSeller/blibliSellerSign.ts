import { md5Hex } from "./md5Hex.ts";

/**
 * Blibli Signature header (optional when seller enables Signature Key).
 * Mirrors seller-api-client-php SignatureGenerator:
 * HMAC-SHA256(secret, METHOD + "\\n" + md5(body)|"" + "\\n" + contentType + "\\n" + date + "\\n" + url)
 * date format Asia/Jakarta: "D M d H:i:s T Y" (e.g. Mon May 16 14:07:15 WIB 2016)
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format millis timestamp as Blibli signature date in Asia/Jakarta (WIB, UTC+7). */
export function formatBlibliSignatureDate(millis: number): string {
  const d = new Date(millis + 7 * 60 * 60 * 1000);
  const weekday = WEEKDAYS[d.getUTCDay()]!;
  const month = MONTHS[d.getUTCMonth()]!;
  const day = pad2(d.getUTCDate());
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  const year = d.getUTCFullYear();
  return `${weekday} ${month} ${day} ${time} WIB ${year}`;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export type BlibliSignatureInput = {
  signatureKey: string;
  method: string;
  /** Full request path including query string, as used by Blibli client. */
  requestUrl: string;
  contentType: string;
  body?: string;
  /** Epoch millis; also sent as Signature-Time header. */
  signatureTimeMillis: number;
};

export async function buildBlibliSignatureHeaders(
  input: BlibliSignatureInput,
): Promise<{ Signature: string; "Signature-Time": string }> {
  const method = input.method.trim().toUpperCase();
  const bodyRaw = input.body ?? "";
  const escaped = bodyRaw.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  const bodyPart = escaped !== "" ? md5Hex(escaped) : "";
  const patternDate = formatBlibliSignatureDate(input.signatureTimeMillis);
  const apiKey =
    `${method}\n${bodyPart.trim()}\n${input.contentType.trim()}\n${patternDate}\n${input.requestUrl}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(apiKey));
  return {
    Signature: toBase64(new Uint8Array(sig)),
    "Signature-Time": String(input.signatureTimeMillis),
  };
}
