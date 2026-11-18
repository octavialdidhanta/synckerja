import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  amountsMatch,
  finalPaymentStatus,
  midtransSignature,
  verifyMidtransTransaction,
} from "./midtransVerify.ts";

const SERVER_KEY = "SB-Mid-server-test-key";
const ORDER = "SUB-1730000000-abc";

async function statusBody(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    order_id: ORDER,
    status_code: "200",
    gross_amount: "99000.00",
    transaction_status: "settlement",
    transaction_id: "tx-1",
    payment_type: "bank_transfer",
    va_numbers: [{ bank: "bca", va_number: "123" }],
    settlement_time: "2026-11-18 10:00:00",
    ...overrides,
  };
  if (!("signature_key" in overrides)) {
    base.signature_key = await midtransSignature(
      String(base.order_id),
      String(base.status_code),
      String(base.gross_amount),
      SERVER_KEY,
    );
  }
  return base;
}

function fakeFetch(body: unknown, status = 200, calls: string[] = []): typeof fetch {
  return ((url: string | URL, init?: RequestInit) => {
    calls.push(`${String(url)} ${(init?.headers as Record<string, string>)?.Authorization ?? ""}`);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
}

const base = { orderId: ORDER, expectedAmount: 99000, serverKey: SERVER_KEY, coreApiBaseUrl: "https://api.sandbox.midtrans.com" };

Deno.test("signature is SHA-512 of order_id + status_code + gross_amount + server key", async () => {
  const sig = await midtransSignature("o", "200", "1.00", "k");
  assertEquals(sig.length, 128);
  assertEquals(sig, await midtransSignature("o", "200", "1.00", "k"));
  assertEquals(sig === (await midtransSignature("o", "200", "1.00", "other")), false);
});

Deno.test("trusts only Midtrans' signed answer and asks with the server key", async () => {
  const calls: string[] = [];
  const res = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch(await statusBody(), 200, calls) });
  assertEquals(res.ok, true);
  if (res.ok) {
    assertEquals(res.status.transaction_status, "settlement");
    assertEquals(res.status.bank, "bca");
  }
  assertEquals(calls[0], `https://api.sandbox.midtrans.com/v2/${ORDER}/status Basic ${btoa(`${SERVER_KEY}:`)}`);
});

Deno.test("rejects a forged or mismatched answer", async () => {
  const forged = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch(await statusBody({ signature_key: "00" })) });
  assertEquals(forged, { ok: false, httpStatus: 401, reason: "Midtrans signature mismatch" });

  // Signed with a different key (e.g. sandbox vs production mix-up).
  const otherKeySig = await midtransSignature(ORDER, "200", "99000.00", "another-key");
  const wrongKey = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch(await statusBody({ signature_key: otherKeySig })) });
  assertEquals(wrongKey.ok, false);

  const otherOrder = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch(await statusBody({ order_id: "SUB-other" })) });
  assertEquals(otherOrder, { ok: false, httpStatus: 400, reason: "Midtrans order_id mismatch" });

  const cheaper = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch(await statusBody({ gross_amount: "1000.00" })) });
  assertEquals(cheaper, { ok: false, httpStatus: 400, reason: "Paid amount does not match the order" });
});

Deno.test("rejects unknown orders, HTTP errors and missing config", async () => {
  const unknown = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch({ status_code: "404", status_message: "not found" }) });
  assertEquals(unknown, { ok: false, httpStatus: 404, reason: "Order not found at Midtrans" });

  const down = await verifyMidtransTransaction({ ...base, fetchImpl: fakeFetch({}, 503) });
  assertEquals(down.ok, false);

  const noKey = await verifyMidtransTransaction({ ...base, serverKey: "", fetchImpl: fakeFetch(await statusBody()) });
  assertEquals(noKey, { ok: false, httpStatus: 500, reason: "MIDTRANS_SERVER_KEY not configured" });
});

Deno.test("amount check tolerates Midtrans formatting only", () => {
  assertEquals(amountsMatch("99000.00", 99000), true);
  assertEquals(amountsMatch("99000.00", "99000"), true);
  assertEquals(amountsMatch("98000.00", 99000), false);
  assertEquals(amountsMatch("abc", 99000), false);
});

Deno.test("maps Midtrans status to payment status, holding fraud challenges", () => {
  assertEquals(finalPaymentStatus("settlement"), "success");
  assertEquals(finalPaymentStatus("capture", "accept"), "success");
  assertEquals(finalPaymentStatus("capture"), "success");
  assertEquals(finalPaymentStatus("capture", "challenge"), "pending");
  assertEquals(finalPaymentStatus("capture", "deny"), "failed");
  assertEquals(finalPaymentStatus("pending"), "pending");
  assertEquals(finalPaymentStatus("expire"), "failed");
  assertEquals(finalPaymentStatus("success"), "pending");
});
