/**
 * Minimal RFC822/MIME parser for Deno Edge — no Node mailparser dependency.
 */

export type ParsedEmail = {
  from: string;
  subject: string;
  messageId: string | null;
  text: string;
  html: string;
};

function decodeBytes(bytes: Uint8Array, charset = "utf-8"): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const ch = withoutSoftBreaks[i];
    if (ch === "=" && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
}

function normalizeCharset(charset: string | null | undefined): string {
  if (!charset) return "utf-8";
  const normalized = charset.trim().toLowerCase().replace(/['"]/g, "");
  if (normalized.includes("utf-8") || normalized === "utf8") return "utf-8";
  if (normalized.includes("windows-1252") || normalized === "cp1252") return "windows-1252";
  if (normalized.includes("iso-8859-1") || normalized === "latin1") return "iso-8859-1";
  return normalized;
}

function decodeBody(content: string, encoding: string | null, charset: string | null = null): string {
  const enc = (encoding ?? "").toLowerCase().trim();
  const cs = normalizeCharset(charset);
  if (enc === "base64") {
    const cleaned = content.replace(/\s/g, "");
    try {
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return decodeBytes(bytes, cs);
    } catch {
      return content.trim();
    }
  }
  if (enc === "quoted-printable") return decodeQuotedPrintable(content);
  return content;
}

function looksQuotedPrintable(content: string): boolean {
  return /=3[Dd0-9A-Fa-f]{2}/.test(content) && !/<(?:html|table|body|!doctype)\b/i.test(content);
}

/** Decode MIME part; auto-detect quoted-printable when header is missing or wrong. */
function smartDecodeBody(content: string, encoding: string | null, charset: string | null = null): string {
  let decoded = decodeBody(content, encoding, charset).trim();
  if (!/<(?:html|table|body|!doctype)\b/i.test(decoded) && looksQuotedPrintable(decoded)) {
    decoded = decodeQuotedPrintable(decoded).trim();
  }
  if (!/<(?:html|table|body|!doctype)\b/i.test(decoded) && looksQuotedPrintable(content)) {
    decoded = decodeQuotedPrintable(content.replace(/=\r?\n/g, "")).trim();
  }
  return decoded;
}

function decodeHeaderValue(value: string): string {
  let out = value.trim();
  const encodedWord = /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi;
  out = out.replace(encodedWord, (_m, charset: string, enc: string, text: string) => {
    try {
      if (enc.toUpperCase() === "B") {
        const bin = atob(text);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return decodeBytes(bytes, charset);
      }
      return decodeQuotedPrintable(text.replace(/_/g, " "));
    } catch {
      return text;
    }
  });
  return out;
}

function parseHeaders(raw: string): Map<string, string> {
  const headers = new Map<string, string>();
  const lines = raw.split(/\r?\n/);
  let currentKey = "";
  let currentVal = "";

  for (const line of lines) {
    if (line.trim() === "") break;
    if (/^[\t ]/.test(line) && currentKey) {
      currentVal += ` ${line.trim()}`;
      continue;
    }
    if (currentKey) headers.set(currentKey.toLowerCase(), currentVal.trim());
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    currentKey = line.slice(0, idx).trim().toLowerCase();
    currentVal = line.slice(idx + 1).trim();
  }
  if (currentKey) headers.set(currentKey, currentVal.trim());
  return headers;
}

function getBoundary(contentType: string | null): string | null {
  if (!contentType) return null;
  const m = /boundary\s*=\s*"?([^";\r\n]+)"?/i.exec(contentType);
  return m?.[1]?.trim() ?? null;
}

function parseCharset(contentType: string | null): string | null {
  if (!contentType) return null;
  const m = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType);
  return m?.[1]?.trim().toLowerCase() ?? null;
}

function splitMultipart(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  const segments: string[] = [];
  let searchFrom = 0;
  while (searchFrom < body.length) {
    const idx = body.indexOf(delim, searchFrom);
    if (idx === -1) break;
    const partStart = idx + delim.length;
    const nextIdx = body.indexOf(delim, partStart);
    const chunk = body.slice(partStart, nextIdx === -1 ? body.length : nextIdx);
    const trimmed = chunk.replace(/^[\r\n]+/, '').replace(/[\r\n]+--[\r\n\s]*$/, '').trim();
    if (trimmed && trimmed !== '--') segments.push(trimmed);
    if (nextIdx === -1) break;
    searchFrom = nextIdx;
  }
  return segments;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|blockquote)>/gi, "\n\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type MimePart = { headers: Map<string, string>; body: string };

function parsePart(rawPart: string): MimePart {
  const sep = rawPart.search(/\r?\n\r?\n/);
  if (sep === -1) return { headers: new Map(), body: rawPart };
  const headerBlock = rawPart.slice(0, sep);
  const body = rawPart.slice(sep).replace(/^\r?\n\r?\n/, "");
  return { headers: parseHeaders(headerBlock), body };
}

function extractHtmlByDoctype(full: string): string {
  const match = /<!DOCTYPE html[\s\S]*|<html[\s>][\s\S]*/i.exec(full);
  if (!match) return "";
  const start = match.index ?? 0;
  const tail = full.slice(start);
  const endMatch = /\r?\n--[A-Za-z0-9_=+'./-]{8,}/.exec(tail);
  const raw = (endMatch ? tail.slice(0, endMatch.index) : tail).trim();
  if (!raw || raw.length < 200) return "";
  const ctMatch = /content-transfer-encoding:\s*([^\r\n]+)/i.exec(full.slice(0, start));
  const encoding = ctMatch?.[1]?.trim() ?? null;
  if (/base64/i.test(encoding ?? "") && !raw.includes("<")) {
    return decodeBody(raw, "base64", parseCharset(/charset=([^;\s]+)/i.exec(full.slice(0, start))?.[1] ?? null)).trim();
  }
  if (/quoted-printable/i.test(encoding ?? "") && /=3D/i.test(raw)) {
    return decodeQuotedPrintable(raw).trim();
  }
  if (looksQuotedPrintable(raw)) {
    return decodeQuotedPrintable(raw.replace(/=\r?\n/g, "")).trim();
  }
  return raw;
}

function extractHtmlFromFullScan(full: string): string {
  const patterns = [
    /<!DOCTYPE html[\s\S]*?<\/html>/i,
    /<html[\s>][\s\S]*?<\/html>/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(full);
    if (match && match[0].length > 500) return match[0].trim();
  }
  if (!looksQuotedPrintable(full)) return "";
  const qp = decodeQuotedPrintable(full.replace(/=\r?\n/g, ""));
  for (const pattern of patterns) {
    const match = pattern.exec(qp);
    if (match && match[0].length > 500) return match[0].trim();
  }
  return "";
}

function extractAllHtmlFromRaw(full: string): string {
  const parts: string[] = [];
  const lower = full.toLowerCase();
  let searchFrom = 0;
  while (searchFrom < full.length) {
    const idx = lower.indexOf("content-type: text/html", searchFrom);
    if (idx === -1) break;
    const headerEnd = full.indexOf("\r\n\r\n", idx);
    const headerEndLf = headerEnd === -1 ? full.indexOf("\n\n", idx) : headerEnd;
    const sepLen = headerEnd !== -1 ? 4 : 2;
    const headerStart = headerEndLf === -1 ? idx : headerEndLf;
    if (headerStart === -1) break;
    const bodyStart = headerStart + sepLen;
    const headerBlock = full.slice(idx, bodyStart);
    const headers = parseHeaders(headerBlock.replace(/^\r?\n/, ""));
    const tail = full.slice(bodyStart);
    const endMatch = /\r?\n--[^\r\n]+/.exec(tail);
    const rawPart = (endMatch ? tail.slice(0, endMatch.index) : tail.slice(0, 500_000)).trim();
    if (rawPart) {
      const encoding = headers.get("content-transfer-encoding") ?? null;
      const charset = parseCharset(headers.get("content-type") ?? null);
      const decoded = smartDecodeBody(rawPart, encoding, charset).trim();
      if (decoded.length > 200) parts.push(decoded);
    }
    searchFrom = bodyStart + 1;
  }
  if (parts.length === 0) return "";
  return parts.sort((a, b) => b.length - a.length)[0] ?? "";
}

function extractBodies(part: MimePart): { text: string; html: string } {
  const contentType = part.headers.get("content-type") ?? "text/plain";
  const encoding = part.headers.get("content-transfer-encoding") ?? null;
  const mainType = contentType.split(";")[0].trim().toLowerCase();

  if (mainType.startsWith("multipart/")) {
    const boundary = getBoundary(contentType);
    if (!boundary) return { text: "", html: "" };
    let text = "";
    let html = "";
    for (const sub of splitMultipart(part.body, boundary)) {
      const nested = extractBodies(parsePart(sub));
      if (nested.text.length > text.length) text = nested.text;
      if (nested.html.length > html.length) html = nested.html;
    }
    return { text, html };
  }

  const charset = parseCharset(contentType);
  const decoded = smartDecodeBody(part.body, encoding, charset).trim();
  if (mainType === "text/html") return { text: "", html: decoded };
  if (mainType === "text/plain") return { text: decoded, html: "" };
  return { text: "", html: "" };
}

function extractHtmlFallback(full: string): string {
  const marker = /content-type:\s*text\/html[\s\S]*?\r?\n\r?\n/i;
  const match = marker.exec(full);
  if (!match) return "";
  const start = match.index! + match[0].length;
  const tail = full.slice(start);
  const endMatch = /\r?\n--[^\r\n]+/.exec(tail);
  const raw = (endMatch ? tail.slice(0, endMatch.index) : tail).trim();
  if (!raw) return "";
  const fakeHeaders = parseHeaders(match[0].replace(/\r?\n\r?\n[\s\S]*$/, ""));
  const encoding = fakeHeaders.get("content-transfer-encoding") ?? null;
  const charset = parseCharset(fakeHeaders.get("content-type") ?? null);
  return smartDecodeBody(raw, encoding, charset).trim();
}

export function parseRawEmail(raw: Uint8Array | string): ParsedEmail {
  const full = typeof raw === "string" ? raw : decodeBytes(raw);
  const sep = full.search(/\r?\n\r?\n/);
  const headerBlock = sep === -1 ? full : full.slice(0, sep);
  const bodyBlock = sep === -1 ? "" : full.slice(sep).replace(/^\r?\n\r?\n/, "");

  const headers = parseHeaders(headerBlock);
  const root: MimePart = { headers, body: bodyBlock };
  let { text, html } = extractBodies(root);
  if (!html.trim()) {
    html = extractAllHtmlFromRaw(full);
  }
  if (!html.trim()) {
    html = extractHtmlByDoctype(full);
  }
  if (!html.trim()) {
    html = extractHtmlFallback(full);
  }
  if (!html.trim()) {
    html = extractHtmlFromFullScan(full);
  }

  const from = decodeHeaderValue(headers.get("from") ?? "");
  const subject = decodeHeaderValue(headers.get("subject") ?? "");
  const messageIdRaw = headers.get("message-id") ?? "";
  const messageId = messageIdRaw.replace(/^<|>$/g, "").trim() || null;

  return {
    from,
    subject,
    messageId,
    text,
    html,
  };
}

export function parsedEmailBody(parsed: ParsedEmail): string {
  if (parsed.html.trim()) return parsed.html.trim();
  if (parsed.text.trim()) return parsed.text.trim();
  return "";
}
