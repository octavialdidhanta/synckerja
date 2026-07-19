import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildBlibliBasicAuthHeader,
  buildBlibliChatIframeUrl,
} from "./blibliSellerAuth.ts";
import { formatBlibliSignatureDate, buildBlibliSignatureHeaders } from "./blibliSellerSign.ts";
import { md5Hex } from "./md5Hex.ts";
import {
  countEventsInWindow,
  isBlibliOttRateLimited,
  retryAfterSecondsForWindow,
} from "./blibliOttRateLimit.ts";

Deno.test("buildBlibliBasicAuthHeader encodes clientId:clientKey", () => {
  const header = buildBlibliBasicAuthHeader("myClient", "myKey");
  assertEquals(header.startsWith("Basic "), true);
  const decoded = atob(header.slice("Basic ".length));
  assertEquals(decoded, "myClient:myKey");
});

Deno.test("buildBlibliChatIframeUrl", () => {
  const url = buildBlibliChatIframeUrl("tok+en/1", "https://seller.blibli.com/");
  assertEquals(
    url,
    "https://seller.blibli.com/conversations?authToken=tok%2Ben%2F1&mode=iframe",
  );
});

Deno.test("md5Hex empty and hello", () => {
  assertEquals(md5Hex(""), "d41d8cd98f00b204e9800998ecf8427e");
  assertEquals(md5Hex("hello"), "5d41402abc4b2a76b9719d911017c592");
});

Deno.test("formatBlibliSignatureDate uses WIB", () => {
  // 2016-05-16T07:07:15.000Z == 14:07:15 WIB
  const s = formatBlibliSignatureDate(Date.UTC(2016, 4, 16, 7, 7, 15));
  assertEquals(s, "Mon May 16 14:07:15 WIB 2016");
});

Deno.test("buildBlibliSignatureHeaders returns Signature + Signature-Time", async () => {
  const millis = Date.UTC(2016, 4, 16, 7, 7, 15);
  const headers = await buildBlibliSignatureHeaders({
    signatureKey: "test-secret",
    method: "GET",
    requestUrl: "/proxy/seller/v1/chats/tokens?requestId=1",
    contentType: "application/json",
    body: "",
    signatureTimeMillis: millis,
  });
  assertEquals(typeof headers.Signature, "string");
  assertEquals(headers.Signature.length > 10, true);
  assertEquals(headers["Signature-Time"], String(millis));
});

Deno.test("OTT rate limit window counter", () => {
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const stamps = [
    "2026-07-18T11:10:00.000Z",
    "2026-07-18T11:20:00.000Z",
    "2026-07-18T10:50:00.000Z", // outside 1h
  ];
  assertEquals(countEventsInWindow(stamps, now), 2);
  assertEquals(isBlibliOttRateLimited(9, 10), false);
  assertEquals(isBlibliOttRateLimited(10, 10), true);
  const retry = retryAfterSecondsForWindow("2026-07-18T11:10:00.000Z", now);
  assertEquals(retry, 10 * 60); // unlock at 12:10
});
