import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EMPTY_PROFILE,
  NOT_PHONE_NUMBER_ID,
  normalizeDisplayPhone,
  parsePhoneProfile,
  pickDisplayPhoneFromList,
} from "./phoneLookup.ts";

Deno.test("normalizes Meta display numbers", () => {
  assertEquals(normalizeDisplayPhone(6281234), "+6281234");
  assertEquals(normalizeDisplayPhone(" +62 812 "), "+62 812");
  assertEquals(normalizeDisplayPhone(""), null);
  assertEquals(normalizeDisplayPhone(null), null);
});

Deno.test("reads a phone profile and rejects non phone-number IDs like before", () => {
  assertEquals(parsePhoneProfile(true, { verified_name: " Sate Sultan ", display_phone_number: "6281" }), {
    verified_name: "Sate Sultan",
    display_phone_number: "+6281",
  });
  assertThrows(() => parsePhoneProfile(false, { error: { message: "Object does not exist" } }), Error, NOT_PHONE_NUMBER_ID);
  assertThrows(() => parsePhoneProfile(true, {}), Error, EMPTY_PROFILE);
  assertEquals(parsePhoneProfile(false, { error: { message: "rate limited" } }), {
    verified_name: null,
    display_phone_number: null,
  });
});

Deno.test("picks the display number from the WABA list", () => {
  const list = { data: [{ id: "a", display_phone_number: "1" }, { id: "b", display_phone_number: "622" }] };
  assertEquals(pickDisplayPhoneFromList(true, list, "b"), "+622");
  assertEquals(pickDisplayPhoneFromList(true, list, "z"), null);
  assertEquals(pickDisplayPhoneFromList(false, list, "b"), null);
});
