import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSignupRequest, pickPhoneNumbers, randomPin } from "./logic.ts";

const ORG = "11111111-1111-4111-8111-111111111111";

Deno.test("parseSignupRequest — connect defaults to coexistence", () => {
  const res = parseSignupRequest({ organization_id: ORG, code: "abc", waba_id: "123456789" });
  assertEquals(res, {
    ok: true,
    value: { action: "connect", organizationId: ORG, code: "abc", wabaId: "123456789", phoneNumberId: null, mode: "coexistence" },
  });
});

Deno.test("parseSignupRequest — rejects bad org, waba, phone, mode, action", () => {
  assertEquals(parseSignupRequest({ organization_id: "x", code: "a", waba_id: "123456" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, code: "a", waba_id: "abc" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, code: "a", waba_id: "123456", phone_number_id: "1; drop" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, code: "a", waba_id: "123456", mode: "on_premise" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, action: "delete" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, waba_id: "123456" }).ok, false);
  assertEquals(parseSignupRequest(null).ok, false);
});

Deno.test("parseSignupRequest — retry_sync needs a phone number id", () => {
  assertEquals(parseSignupRequest({ organization_id: ORG, action: "retry_sync" }).ok, false);
  assertEquals(parseSignupRequest({ organization_id: ORG, action: "retry_sync", phone_number_id: "1020019174528024" }), {
    ok: true,
    value: { action: "retry_sync", organizationId: ORG, phoneNumberId: "1020019174528024" },
  });
});

Deno.test("pickPhoneNumbers — one requested number, or every valid number on the WABA", () => {
  const numbers = [{ id: "111111" }, { id: "222222" }, { id: "bad" }];
  assertEquals(pickPhoneNumbers(numbers, "222222").map((n) => n.id), ["222222"]);
  assertEquals(pickPhoneNumbers(numbers, "999999"), []);
  assertEquals(pickPhoneNumbers(numbers, null).map((n) => n.id), ["111111", "222222"]);
});

Deno.test("randomPin — six digits, skips biased bytes", () => {
  const pin = randomPin();
  assertEquals(/^\d{6}$/.test(pin), true);
  const fixed = randomPin(() => new Uint8Array([255, 251, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  assertEquals(fixed, "123456");
});
