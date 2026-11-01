const PDF_LIMIT_BYTES = 25 * 1024 * 1024;

export function pdfByteLimit(): number {
  return PDF_LIMIT_BYTES;
}

export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("invalid_input");
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_input");
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || isBlockedHost(host)) throw new Error("invalid_input");
  return url;
}

export function isBlockedHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  if (!name || name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name === "metadata.google.internal" || name.endsWith(".internal")) return true;
  return isBlockedIp(name);
}

export function isBlockedIp(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  const value = mapped ? mapped[1] : address;
  const v4 = parseV4(value);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const v6 = address.toLowerCase();
  if (!v6.includes(":")) return false;
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
  return false;
}

export function assertPdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 5 || bytes.byteLength > PDF_LIMIT_BYTES) throw new Error("invalid_input");
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (header !== "%PDF") throw new Error("invalid_input");
}

export function pdfFileName(url: URL): string {
  const raw = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const withExt = cleaned.endsWith(".pdf") ? cleaned : `${cleaned || "lead-magnet"}.pdf`;
  const clipped = withExt.slice(0, 80);
  return clipped.endsWith(".pdf") ? clipped : `${clipped.slice(0, 76)}.pdf`;
}

function parseV4(address: string): [number, number, number, number] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return numbers as [number, number, number, number];
}
