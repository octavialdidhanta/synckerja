import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mergeAttributionWithCtwa,
  mergeCtwaClid,
  parseCtwaClidFromAttribution,
  parseCtwaReferral,
} from "./ctwaReferral.ts";

Deno.test("parseCtwaReferral — valid payload", () => {
  const result = parseCtwaReferral({
    ctwa_clid: "click-123",
    source_type: "ad",
    source_id: "ad-1",
    source_url: "https://example.com",
    headline: "Hello",
  });
  assertEquals(result?.ctwa_clid, "click-123");
  assertEquals(result?.source_type, "ad");
  assertEquals(result?.source_id, "ad-1");
});

Deno.test("parseCtwaReferral — CTWA_CLID alias", () => {
  const result = parseCtwaReferral({ CTWA_CLID: "alias-id" });
  assertEquals(result?.ctwa_clid, "alias-id");
});

Deno.test("parseCtwaReferral — missing click id", () => {
  assertEquals(parseCtwaReferral({ source_type: "ad" }), null);
  assertEquals(parseCtwaReferral(null), null);
  assertEquals(parseCtwaReferral("string"), null);
});

Deno.test("parseCtwaClidFromAttribution — object and JSON string", () => {
  assertEquals(parseCtwaClidFromAttribution({ ctwa_clid: "from-attr" }), "from-attr");
  assertEquals(parseCtwaClidFromAttribution('{"ctwa_clid":"json-id"}'), "json-id");
  assertEquals(parseCtwaClidFromAttribution("{bad json"), null);
});

Deno.test("mergeCtwaClid — column wins over attribution", () => {
  assertEquals(mergeCtwaClid("col-id", { ctwa_clid: "attr-id" }), "col-id");
  assertEquals(mergeCtwaClid(null, { ctwa_clid: "attr-only" }), "attr-only");
});

Deno.test("mergeAttributionWithCtwa — preserves existing keys", () => {
  const merged = mergeAttributionWithCtwa(
    { fbclid: "fb-1", landing_url: "https://x.com" },
    {
      ctwa_clid: "ctwa-1",
      source_type: "ad",
      source_id: "src-1",
      source_url: "https://ad.com",
      headline: "Hi",
      body: null,
      raw: { ctwa_clid: "ctwa-1" },
    },
    "2026-08-12T12:00:00.000Z",
  );
  assertEquals(merged.fbclid, "fb-1");
  assertEquals(merged.landing_url, "https://x.com");
  assertEquals(merged.ctwa_clid, "ctwa-1");
  assertEquals(merged.ctwa_source_type, "ad");
  assertEquals(merged.ctwa_captured_at, "2026-08-12T12:00:00.000Z");
});
