// Pure parsing for WhatsApp Coexistence webhooks (smb_message_echoes, history,
// smb_app_state_sync, account_update). No Deno or network imports so the MCP
// service tests can load it with Node.
// Payload shapes follow Meta's "Onboarding WhatsApp Business app users" docs.

export type CoexMessageRow = {
  waMessageId: string;
  customerWaId: string;
  direction: "inbound" | "outbound";
  body: string;
  messageType: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

export type HistoryChunk = {
  phase: number | null;
  chunkOrder: number | null;
  progress: number | null;
  rows: CoexMessageRow[];
  declined: { code: number | null; message: string | null } | null;
};

export type ContactSync = {
  phoneDigits: string;
  fullName: string | null;
  action: "add" | "remove";
};

export type PartnerRemoved = {
  phoneDigits: string | null;
  reason: string | null;
  initiatedBy: string | null;
};

export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function unixToIso(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

/** Text shown in livechat for one message, mirroring how inbound messages are stored. */
export function messageBody(message: Record<string, unknown>): { body: string; type: string } {
  const type = str(message.type) ?? "text";
  if (type === "text") return { body: str(asRecord(message.text).body) ?? "", type };
  if (MEDIA_TYPES.has(type)) {
    const caption = str(asRecord(message[type]).caption);
    return { body: caption ?? `[${type}]`, type };
  }
  if (type === "media_placeholder") return { body: "[media]", type };
  if (type === "location") return { body: "[location]", type };
  if (type === "contacts") return { body: "[contact]", type };
  if (type === "reaction") return { body: str(asRecord(message.reaction).emoji) ?? "[reaction]", type };
  if (type === "interactive") {
    const interactive = asRecord(message.interactive);
    const reply = asRecord(interactive.button_reply ?? interactive.list_reply);
    return { body: str(reply.title) ?? "[interactive]", type };
  }
  if (type === "button") return { body: str(asRecord(message.button).text) ?? "[button]", type };
  return { body: `[${type}]`, type };
}

/** smb_message_echoes: messages the business sent from the WhatsApp Business app. */
export function parseMessageEchoes(value: unknown): CoexMessageRow[] {
  const echoes = asRecord(value).message_echoes;
  if (!Array.isArray(echoes)) return [];
  const rows: CoexMessageRow[] = [];
  for (const item of echoes) {
    const echo = asRecord(item);
    const id = str(echo.id);
    const to = digitsOnly(echo.to);
    if (!id || !to) continue;
    const { body, type } = messageBody(echo);
    rows.push({
      waMessageId: id,
      customerWaId: to,
      direction: "outbound",
      body,
      messageType: type,
      createdAt: unixToIso(echo.timestamp),
      raw: { ...echo, coexistence_source: "smb_message_echoes" },
    });
  }
  return rows;
}

/**
 * history: past chats shared during onboarding. A thread id is the customer's number;
 * a message is inbound when it comes from that number, otherwise it was sent by the business.
 */
export function parseHistory(value: unknown): HistoryChunk[] {
  const history = asRecord(value).history;
  if (!Array.isArray(history)) return [];
  return history.map((item) => {
    const chunk = asRecord(item);
    const meta = asRecord(chunk.metadata);
    const errors = Array.isArray(chunk.errors) ? chunk.errors.map(asRecord) : [];
    const declined = errors.length > 0
      ? {
        code: Number.isFinite(Number(errors[0].code)) ? Number(errors[0].code) : null,
        message: str(errors[0].message) ?? str(errors[0].title),
      }
      : null;
    const rows: CoexMessageRow[] = [];
    const threads = Array.isArray(chunk.threads) ? chunk.threads.map(asRecord) : [];
    for (const thread of threads) {
      const customer = digitsOnly(thread.id);
      if (!customer) continue;
      const messages = Array.isArray(thread.messages) ? thread.messages.map(asRecord) : [];
      for (const message of messages) {
        const id = str(message.id);
        if (!id) continue;
        const { body, type } = messageBody(message);
        rows.push({
          waMessageId: id,
          customerWaId: customer,
          direction: digitsOnly(message.from) === customer ? "inbound" : "outbound",
          body,
          messageType: type,
          createdAt: unixToIso(message.timestamp),
          raw: { ...message, coexistence_source: "history" },
        });
      }
    }
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      phase: num(meta.phase),
      chunkOrder: num(meta.chunk_order),
      progress: num(meta.progress),
      rows,
      declined,
    };
  });
}

/** History is finished once phase 2 reports 100% progress. */
export function historyStatus(chunk: Pick<HistoryChunk, "phase" | "progress" | "declined">): "declined" | "done" | "running" {
  if (chunk.declined) return "declined";
  if (chunk.phase === 2 && chunk.progress === 100) return "done";
  return "running";
}

/** smb_app_state_sync: contact changes in the WhatsApp Business app. */
export function parseStateSync(value: unknown): ContactSync[] {
  const items = asRecord(value).state_sync;
  if (!Array.isArray(items)) return [];
  const out: ContactSync[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (str(row.type) !== "contact") continue;
    const contact = asRecord(row.contact);
    const phoneDigits = digitsOnly(contact.phone_number);
    const action = str(row.action) === "remove" ? "remove" : "add";
    if (!phoneDigits) continue;
    out.push({ phoneDigits, fullName: str(contact.full_name) ?? str(contact.first_name), action });
  }
  return out;
}

/** account_update with event PARTNER_REMOVED; other events return null. */
export function parsePartnerRemoved(value: unknown): PartnerRemoved | null {
  const row = asRecord(value);
  if (str(row.event) !== "PARTNER_REMOVED") return null;
  const info = asRecord(row.disconnection_info);
  const phoneDigits = digitsOnly(row.phone_number);
  return { phoneDigits: phoneDigits || null, reason: str(info.reason), initiatedBy: str(info.initiated_by) };
}

/** Rows not yet stored, keeping the first copy of a repeated id. */
export function freshRows(rows: CoexMessageRow[], existingIds: Set<string>): CoexMessageRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (existingIds.has(row.waMessageId) || seen.has(row.waMessageId)) return false;
    seen.add(row.waMessageId);
    return true;
  });
}

/** Last message and last/first inbound times for one customer, used to create or update the conversation. */
export function threadSummary(rows: CoexMessageRow[]): {
  lastAt: string;
  lastBody: string;
  lastInboundAt: string | null;
  firstInboundAt: string | null;
} | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = sorted[sorted.length - 1];
  const inbound = sorted.filter((row) => row.direction === "inbound");
  return {
    lastAt: last.createdAt,
    lastBody: last.body.slice(0, 200),
    lastInboundAt: inbound.length ? inbound[inbound.length - 1].createdAt : null,
    firstInboundAt: inbound.length ? inbound[0].createdAt : null,
  };
}
