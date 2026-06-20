/**
 * Minimal IMAP client using Deno.connectTls — reliable on Supabase Edge (no Node net).
 */

import { formatImapAuthError } from "./emailImapProviders.ts";

export type DenoImapConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** e.g. "Gmail (IMAP)" — used for provider-specific auth error messages */
  provider?: string | null;
};

export type FetchedImapMessage = {
  uid: number;
  raw: Uint8Array;
};

let tagCounter = 0;
function nextTag(): string {
  tagCounter += 1;
  return `A${String(tagCounter).padStart(3, "0")}`;
}

/** Non-synchronizing literal — safe for passwords with quotes, spaces, or special chars. */
function imapLiteral(s: string): string {
  const byteLen = new TextEncoder().encode(s).length;
  return `{${byteLen}+}\r\n${s}`;
}

function quoteImapAtom(s: string): string {
  if (/^[^\x00-\x1f\x7f"\\]+$/.test(s)) {
    return `"${s}"`;
  }
  return imapLiteral(s);
}

function toPlainAuthBlob(user: string, pass: string): string {
  const raw = `\0${user}\0${pass}`;
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

type Conn = Deno.TlsConn;

class ImapResponseReader {
  private buffer = new Uint8Array(0);

  constructor(private conn: Conn) {}

  private async readMore(): Promise<boolean> {
    const chunk = new Uint8Array(16384);
    const n = await this.conn.read(chunk);
    if (n === null) return false;
    const next = new Uint8Array(this.buffer.length + n);
    next.set(this.buffer);
    next.set(chunk.subarray(0, n), this.buffer.length);
    this.buffer = next;
    return true;
  }

  private async ensureBytes(count: number): Promise<boolean> {
    while (this.buffer.length < count) {
      const ok = await this.readMore();
      if (!ok) return false;
    }
    return true;
  }

  private findLiteralHeader(maxScan = 8192): { literalSize: number; headerEndByte: number } | null {
    const scanLen = Math.min(this.buffer.length, maxScan);
    const ascii = new TextDecoder("ascii").decode(this.buffer.subarray(0, scanLen));
    const match = /\{(\d+)\}\r\n/.exec(ascii);
    if (!match || match.index === undefined) return null;
    const literalSize = parseInt(match[1], 10);
    const headerEndByte = new TextEncoder().encode(ascii.slice(0, match.index + match[0].length)).length;
    return { literalSize, headerEndByte };
  }

  async readGreeting(): Promise<string> {
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      if (!(await this.ensureBytes(1))) throw new Error("Unexpected close");
      const view = decoder.decode(this.buffer);
      const crlf = view.indexOf("\r\n");
      if (crlf === -1) {
        await this.readMore();
        continue;
      }
      const line = view.slice(0, crlf);
      const lineBytes = new TextEncoder().encode(view.slice(0, crlf + 2)).length;
      this.buffer = this.buffer.subarray(lineBytes);
      text += `${line}\r\n`;
      if (line.startsWith("* ")) return text;
    }
  }

  async readContinuationOrTagged(
    tag: string,
  ): Promise<{ type: "continuation" } | { type: "tagged"; ok: boolean; data: string; literals: Uint8Array[] }> {
    while (true) {
      if (!(await this.ensureBytes(1))) throw new Error("Unexpected close");

      const view = new TextDecoder().decode(this.buffer);
      const crlf = view.indexOf("\r\n");
      if (crlf === -1) {
        await this.readMore();
        continue;
      }

      const line = view.slice(0, crlf);
      const lineBytes = new TextEncoder().encode(view.slice(0, crlf + 2)).length;
      this.buffer = this.buffer.subarray(lineBytes);

      if (line.startsWith("+")) return { type: "continuation" };
      if (line.startsWith("* ")) continue;
      if (line.startsWith(`${tag} `)) {
        return { ok: line.includes(" OK "), data: `${line}\r\n`, literals: [], type: "tagged" };
      }
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
        return { ok: false, data: `${line}\r\n`, literals: [], type: "tagged" };
      }
    }
  }

  async readTaggedResponse(
    tag: string,
    collectLiterals = false,
  ): Promise<{ ok: boolean; data: string; literals: Uint8Array[] }> {
    const decoder = new TextDecoder();
    let text = "";
    const literals: Uint8Array[] = [];

    while (true) {
      if (!(await this.ensureBytes(1))) throw new Error("Unexpected close");

      const literalHeader = this.findLiteralHeader();
      if (literalHeader) {
        const { literalSize, headerEndByte } = literalHeader;
        const totalNeeded = headerEndByte + literalSize;
        if (!(await this.ensureBytes(totalNeeded))) throw new Error("Unexpected close");

        text += decoder.decode(this.buffer.subarray(0, headerEndByte));
        if (collectLiterals) {
          literals.push(this.buffer.subarray(headerEndByte, headerEndByte + literalSize).slice());
        }
        this.buffer = this.buffer.subarray(headerEndByte + literalSize);
        continue;
      }

      const view = decoder.decode(this.buffer);
      const crlf = view.indexOf("\r\n");
      if (crlf === -1) {
        await this.readMore();
        continue;
      }

      const line = view.slice(0, crlf);
      const lineBytes = new TextEncoder().encode(view.slice(0, crlf + 2)).length;
      this.buffer = this.buffer.subarray(lineBytes);
      text += `${line}\r\n`;

      if (line.startsWith(`${tag} `)) {
        return { ok: line.includes(" OK "), data: text, literals };
      }
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
        return { ok: false, data: text, literals };
      }
    }
  }
}

async function runCommandRaw(
  conn: Conn,
  reader: ImapResponseReader,
  payload: string,
  collectLiterals = false,
): Promise<{ ok: boolean; data: string; literals: Uint8Array[] }> {
  const tag = nextTag();
  await conn.write(new TextEncoder().encode(payload.startsWith(tag) ? payload : `${tag} ${payload}`));
  if (!payload.endsWith("\r\n")) {
    await conn.write(new TextEncoder().encode("\r\n"));
  }
  return reader.readTaggedResponse(tag, collectLiterals);
}

async function runCommand(
  conn: Conn,
  reader: ImapResponseReader,
  command: string,
  collectLiterals = false,
): Promise<{ ok: boolean; data: string; literals: Uint8Array[] }> {
  return runCommandRaw(conn, reader, command, collectLiterals);
}

function extractImapNoLine(response: string): string {
  const match = response.match(/^[A-Z0-9]+ (NO|BAD) (.+)$/m);
  return match?.[2]?.trim() ?? "";
}

async function authenticateImap(
  conn: Conn,
  reader: ImapResponseReader,
  user: string,
  pass: string,
): Promise<{ ok: true } | { ok: false; data: string }> {
  const attempts: string[] = [];

  const quotedLogin = await runCommand(
    conn,
    reader,
    `LOGIN ${quoteImapAtom(user)} ${quoteImapAtom(pass)}`,
  );
  if (quotedLogin.ok) return { ok: true };
  attempts.push(quotedLogin.data);

  const plainBlob = toPlainAuthBlob(user, pass);
  const plainTag = nextTag();
  await conn.write(new TextEncoder().encode(`${plainTag} AUTHENTICATE PLAIN\r\n`));
  const plainWait = await reader.readContinuationOrTagged(plainTag);
  if (plainWait.type === "continuation") {
    await conn.write(new TextEncoder().encode(`${plainBlob}\r\n`));
    const plainResp = await reader.readTaggedResponse(plainTag);
    if (plainResp.ok) return { ok: true };
    attempts.push(plainResp.data);
  } else if (!plainWait.ok) {
    attempts.push(plainWait.data);
  }

  const literalLogin = await runCommand(
    conn,
    reader,
    `LOGIN ${imapLiteral(user)} ${imapLiteral(pass)}`,
  );
  if (literalLogin.ok) return { ok: true };
  attempts.push(literalLogin.data);

  return { ok: false, data: attempts.join("") };
}

async function withImapConnection<T>(
  config: DenoImapConfig,
  fn: (conn: Conn, reader: ImapResponseReader) => Promise<T>,
): Promise<T> {
  tagCounter = 0;
  const conn = await Deno.connectTls({
    hostname: config.host,
    port: config.port,
  });
  const reader = new ImapResponseReader(conn);
  try {
    await reader.readGreeting();
    const login = await authenticateImap(conn, reader, config.user, config.pass);
    if (!login.ok) {
      const detail = extractImapNoLine(login.data);
      const err = new Error("IMAP authentication failed");
      (err as Error & { imapResponse?: string }).imapResponse = detail || login.data;
      throw err;
    }
    return await fn(conn, reader);
  } finally {
    try {
      const tag = nextTag();
      await conn.write(new TextEncoder().encode(`${tag} LOGOUT\r\n`));
      await reader.readTaggedResponse(tag).catch(() => undefined);
    } catch {
      /* ignore */
    }
    try {
      conn.close();
    } catch {
      /* ignore */
    }
  }
}

export async function testDenoImapLogin(
  config: DenoImapConfig,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await withImapConnection(config, async () => true);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const imapResponse =
      e && typeof e === "object" && "imapResponse" in e && typeof (e as { imapResponse?: string }).imapResponse === "string"
        ? (e as { imapResponse: string }).imapResponse
        : "";
    console.error("denoImapClient: login failed", config.host, msg, imapResponse.slice(0, 400));
    if (/auth/i.test(msg) || /failed/i.test(msg)) {
      const serverHint = imapResponse ? ` (${imapResponse})` : "";
      return {
        ok: false,
        message: formatImapAuthError(config.provider, imapResponse) + serverHint,
      };
    }
    return {
      ok: false,
      message: `Gagal koneksi IMAP (${config.host}:${config.port}): ${msg}`,
    };
  }
}

function parseUidList(response: string): number[] {
  const match = /\* SEARCH(?: (.+))?/i.exec(response);
  if (!match?.[1]?.trim()) return [];
  return match[1]
    .trim()
    .split(/\s+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));
}

function pairFetchUidsWithLiterals(response: string, literals: Uint8Array[]): FetchedImapMessage[] {
  const uidMatches = [...response.matchAll(/FETCH \([^)]*UID (\d+)/gi)];
  const messages: FetchedImapMessage[] = [];
  const count = Math.min(uidMatches.length, literals.length);
  for (let i = 0; i < count; i++) {
    messages.push({
      uid: parseInt(uidMatches[i][1], 10),
      raw: literals[i],
    });
  }
  return messages;
}

const BODY_REFRESH_LOOKBACK = 100;
const PLAIN_TEXT_UPGRADE_BATCH = 25;

function quoteImapSearchValue(value: string): string {
  const trimmed = value.trim();
  if (/^[^\x00-\x1f\x7f"\\]+$/.test(trimmed)) return `"${trimmed}"`;
  return imapLiteral(trimmed);
}

async function searchUidsByMessageId(
  conn: Conn,
  reader: ImapResponseReader,
  messageId: string,
): Promise<number[]> {
  const clean = messageId.replace(/^<|>$/g, "").trim();
  if (!clean) return [];
  const variants = [`<${clean}>`, clean];
  const uids = new Set<number>();
  for (const variant of variants) {
    const search = await runCommand(
      conn,
      reader,
      `UID SEARCH HEADER Message-ID ${quoteImapSearchValue(variant)}`,
    );
    for (const uid of parseUidList(search.data)) uids.add(uid);
    if (uids.size > 0) break;
  }
  return [...uids];
}

async function fetchUidsByBodyPeek(
  conn: Conn,
  reader: ImapResponseReader,
  uids: number[],
): Promise<FetchedImapMessage[]> {
  if (uids.length === 0) return [];
  const fetch = await runCommand(
    conn,
    reader,
    `UID FETCH ${uids.join(",")} (UID BODY.PEEK[])`,
    true,
  );
  if (!fetch.ok) throw new Error("UID FETCH failed");
  return pairFetchUidsWithLiterals(fetch.data, fetch.literals);
}

export async function fetchImapMessagesByMessageIds(
  config: DenoImapConfig,
  messageIds: string[],
): Promise<FetchedImapMessage[]> {
  const uniqueIds = [...new Set(messageIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    PLAIN_TEXT_UPGRADE_BATCH,
  );
  if (uniqueIds.length === 0) return [];

  return withImapConnection(config, async (conn, reader) => {
    const select = await runCommand(conn, reader, "SELECT INBOX");
    if (!select.ok) throw new Error("SELECT INBOX failed");

    const uids = new Set<number>();
    for (const messageId of uniqueIds) {
      for (const uid of await searchUidsByMessageId(conn, reader, messageId)) {
        uids.add(uid);
      }
    }
    return fetchUidsByBodyPeek(conn, reader, [...uids].sort((a, b) => a - b));
  });
}

export async function fetchImapMessages(
  config: DenoImapConfig,
  sinceUid: number | null,
  lookback: number,
): Promise<{ messages: FetchedImapMessage[]; maxUid: number | null }> {
  return withImapConnection(config, async (conn, reader) => {
    const select = await runCommand(conn, reader, "SELECT INBOX");
    if (!select.ok) throw new Error("SELECT INBOX failed");

    let uids: number[] = [];
    if (sinceUid != null) {
      const search = await runCommand(conn, reader, `UID SEARCH UID ${sinceUid + 1}:*`);
      uids = parseUidList(search.data);
      const allSearch = await runCommand(conn, reader, "UID SEARCH ALL");
      const refreshUids = parseUidList(allSearch.data).slice(-BODY_REFRESH_LOOKBACK);
      uids = [...new Set([...uids, ...refreshUids])].sort((a, b) => a - b);
    } else {
      const search = await runCommand(conn, reader, "UID SEARCH ALL");
      uids = parseUidList(search.data).slice(-lookback);
    }

    if (uids.length === 0) {
      return { messages: [], maxUid: sinceUid };
    }

    const fetch = await runCommand(
      conn,
      reader,
      `UID FETCH ${uids.join(",")} (UID BODY.PEEK[])`,
      true,
    );
    if (!fetch.ok) throw new Error("UID FETCH failed");

    const messages = pairFetchUidsWithLiterals(fetch.data, fetch.literals);
    const maxUid = messages.reduce((max, m) => Math.max(max, m.uid), sinceUid ?? 0);
    return { messages, maxUid: messages.length > 0 ? maxUid : sinceUid };
  });
}
