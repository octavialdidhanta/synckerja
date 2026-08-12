import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLeadCtwaUpdate,
  waTicketIdFromConvId,
  waTicketPrefixFromConvId,
  waTicketPrefixFromTicketId,
} from "./ctwaLeadSync.ts";

const SAMPLE_CONV_ID = "abcd1234-5678-90ab-cdef-123456789012";

Deno.test("waTicket helpers — roundtrip", () => {
  assertEquals(waTicketPrefixFromConvId(SAMPLE_CONV_ID), "ABCD1234");
  assertEquals(waTicketIdFromConvId(SAMPLE_CONV_ID), "WA-ABCD1234");
  assertEquals(waTicketPrefixFromTicketId("WA-ABCD1234"), "ABCD1234");
  assertEquals(waTicketPrefixFromTicketId("LEAD-123"), null);
  assertEquals(waTicketPrefixFromTicketId("WA-SHORT"), null);
});

Deno.test("buildLeadCtwaUpdate — patch shape", () => {
  const patch = buildLeadCtwaUpdate(
    { fbclid: "fb-99" },
    {
      ctwa_clid: "ctwa-42",
      source_type: "ad",
      source_id: null,
      source_url: null,
      headline: null,
      body: null,
      raw: { ctwa_clid: "ctwa-42" },
    },
    "2026-08-12T10:00:00.000Z",
  );
  assertEquals(patch.ctwa_clid, "ctwa-42");
  assertEquals((patch.attribution as Record<string, unknown>).fbclid, "fb-99");
  assertEquals((patch.attribution as Record<string, unknown>).ctwa_clid, "ctwa-42");
});
