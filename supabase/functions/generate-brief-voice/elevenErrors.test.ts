import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describeElevenError, ELEVEN_CREDIT_CODE } from "./elevenErrors.ts";

Deno.test("402 insufficient_credits is a spent balance", () => {
  const f = describeElevenError(402, { detail: { type: "payment_required", code: "insufficient_credits", message: "Your account does not have enough credits for this operation." } });
  assertEquals([f.credit, f.code, f.status], [true, ELEVEN_CREDIT_CODE, 402]);
});

Deno.test("older 401 quota_exceeded is a spent balance", () => {
  const f = describeElevenError(401, { detail: { status: "quota_exceeded", message: "This request exceeds your quota of 10000. You have 12 credits remaining, while 40 credits are required for this request." } });
  assertEquals([f.credit, f.code, f.status], [true, ELEVEN_CREDIT_CODE, 402]);
});

Deno.test("an invalid key or a bad voice stays a normal error", () => {
  const key = describeElevenError(401, { detail: { status: "invalid_api_key", message: "Invalid API key" } });
  assertEquals([key.credit, key.code, key.status, key.message], [false, null, 401, "Invalid API key"]);
  const empty = describeElevenError(500, {});
  assertEquals(empty.message, "ElevenLabs menolak permintaan (500).");
});
