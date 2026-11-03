import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  freshRows,
  historyStatus,
  messageBody,
  parseHistory,
  parseMessageEchoes,
  parsePartnerRemoved,
  parseStateSync,
  threadSummary,
} from "./parse.ts";

const BUSINESS = "6281234567890";
const CUSTOMER = "6289876543210";

Deno.test("parseMessageEchoes — text echo becomes an outbound row to the customer", () => {
  const rows = parseMessageEchoes({
    messaging_product: "whatsapp",
    metadata: { display_phone_number: BUSINESS, phone_number_id: "111" },
    message_echoes: [
      { from: BUSINESS, to: `+${CUSTOMER}`, id: "wamid.A", timestamp: "1762156800", type: "text", text: { body: "Siap kak, 20 tusuk ya" } },
    ],
  });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].customerWaId, CUSTOMER);
  assertEquals(rows[0].direction, "outbound");
  assertEquals(rows[0].body, "Siap kak, 20 tusuk ya");
  assertEquals(rows[0].createdAt, "2025-11-03T08:00:00.000Z");
  assertEquals(rows[0].raw.coexistence_source, "smb_message_echoes");
});

Deno.test("parseMessageEchoes — media uses caption, skips rows without id or recipient", () => {
  const rows = parseMessageEchoes({
    message_echoes: [
      { from: BUSINESS, to: CUSTOMER, id: "wamid.B", timestamp: "1", type: "image", image: { caption: "Menu" } },
      { from: BUSINESS, to: CUSTOMER, id: "wamid.C", timestamp: "1", type: "video", video: {} },
      { from: BUSINESS, to: "", id: "wamid.D", type: "text", text: { body: "x" } },
      { from: BUSINESS, to: CUSTOMER, type: "text", text: { body: "no id" } },
    ],
  });
  assertEquals(rows.map((r) => [r.waMessageId, r.body]), [["wamid.B", "Menu"], ["wamid.C", "[video]"]]);
});

Deno.test("parseHistory — direction follows the thread's customer number", () => {
  const [chunk] = parseHistory({
    history: [{
      metadata: { phase: 1, chunk_order: 2, progress: 40 },
      threads: [{
        id: CUSTOMER,
        messages: [
          { from: CUSTOMER, id: "wamid.1", timestamp: "100", type: "text", text: { body: "Halo" }, history_context: { status: "READ" } },
          { from: BUSINESS, to: CUSTOMER, id: "wamid.2", timestamp: "160", type: "text", text: { body: "Halo kak" } },
          { from: CUSTOMER, id: "wamid.3", timestamp: "200", type: "media_placeholder" },
        ],
      }],
    }],
  });
  assertEquals(chunk.phase, 1);
  assertEquals(chunk.progress, 40);
  assertEquals(chunk.declined, null);
  assertEquals(chunk.rows.map((r) => [r.waMessageId, r.direction, r.body]), [
    ["wamid.1", "inbound", "Halo"],
    ["wamid.2", "outbound", "Halo kak"],
    ["wamid.3", "inbound", "[media]"],
  ]);
  assertEquals(chunk.rows[0].raw.coexistence_source, "history");
});

Deno.test("parseHistory and historyStatus — declined, running, done", () => {
  const [declined] = parseHistory({ history: [{ errors: [{ code: 2593109, title: "History sharing is turned off" }] }] });
  assertEquals(declined.declined, { code: 2593109, message: "History sharing is turned off" });
  assertEquals(historyStatus(declined), "declined");
  assertEquals(historyStatus({ phase: 1, progress: 100, declined: null }), "running");
  assertEquals(historyStatus({ phase: 2, progress: 100, declined: null }), "done");
});

Deno.test("parseStateSync — contact adds with names; removes kept without name", () => {
  const contacts = parseStateSync({
    state_sync: [
      { type: "contact", contact: { full_name: "Budi PIK", first_name: "Budi", phone_number: `+${CUSTOMER}` }, action: "add", metadata: { timestamp: "1" } },
      { type: "contact", contact: { phone_number: "62811" }, action: "remove" },
      { type: "label", contact: { phone_number: "62822" }, action: "add" },
    ],
  });
  assertEquals(contacts, [
    { phoneDigits: CUSTOMER, fullName: "Budi PIK", action: "add" },
    { phoneDigits: "62811", fullName: null, action: "remove" },
  ]);
});

Deno.test("parsePartnerRemoved — only PARTNER_REMOVED events", () => {
  assertEquals(
    parsePartnerRemoved({ phone_number: BUSINESS, event: "PARTNER_REMOVED", disconnection_info: { reason: "PRIMARY_INACTIVITY", initiated_by: "SYSTEM" } }),
    { phoneDigits: BUSINESS, reason: "PRIMARY_INACTIVITY", initiatedBy: "SYSTEM" },
  );
  assertEquals(parsePartnerRemoved({ event: "PARTNER_ADDED" }), null);
});

Deno.test("freshRows and threadSummary — dedupe and conversation times", () => {
  const rows = parseHistory({
    history: [{
      threads: [{
        id: CUSTOMER,
        messages: [
          { from: CUSTOMER, id: "a", timestamp: "100", type: "text", text: { body: "1" } },
          { from: BUSINESS, id: "b", timestamp: "300", type: "text", text: { body: "3" } },
          { from: CUSTOMER, id: "c", timestamp: "200", type: "text", text: { body: "2" } },
          { from: CUSTOMER, id: "c", timestamp: "200", type: "text", text: { body: "2 again" } },
        ],
      }],
    }],
  })[0].rows;
  const fresh = freshRows(rows, new Set(["a"]));
  assertEquals(fresh.map((r) => r.waMessageId), ["b", "c"]);
  const summary = threadSummary(rows);
  assertEquals(summary?.lastBody, "3");
  assertEquals(summary?.lastInboundAt, new Date(200_000).toISOString());
  assertEquals(summary?.firstInboundAt, new Date(100_000).toISOString());
  assertEquals(threadSummary([]), null);
});

Deno.test("messageBody — common types", () => {
  assertEquals(messageBody({ type: "reaction", reaction: { emoji: "👍" } }).body, "👍");
  assertEquals(messageBody({ type: "interactive", interactive: { button_reply: { title: "Pesan" } } }).body, "Pesan");
  assertEquals(messageBody({ type: "location" }).body, "[location]");
});
