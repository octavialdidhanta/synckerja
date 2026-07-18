import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveFollowConfirmPostbackRoute,
  resolveGetFrameworkPostbackRoute,
  shouldSendOpeningDmAtComment,
} from "./openingFirstFlowRouting.ts";
import { isOpeningFirstDmFlow } from "./types.ts";

Deno.test("isOpeningFirstDmFlow — v2 only", () => {
  assertEquals(isOpeningFirstDmFlow({ dm_flow_version: 2 }), true);
  assertEquals(isOpeningFirstDmFlow({ dm_flow_version: 1 }), false);
  assertEquals(isOpeningFirstDmFlow({}), false);
});

Deno.test("shouldSendOpeningDmAtComment", () => {
  assertEquals(shouldSendOpeningDmAtComment({ dmFlowVersion: 2, skipMaterialOffer: false }), true);
  assertEquals(shouldSendOpeningDmAtComment({ dmFlowVersion: 2, skipMaterialOffer: true }), false);
  assertEquals(shouldSendOpeningDmAtComment({ dmFlowVersion: 1, skipMaterialOffer: false }), false);
});

Deno.test("resolveGetFrameworkPostbackRoute — v2 opening click", () => {
  assertEquals(
    resolveGetFrameworkPostbackRoute({ dm_flow_version: 2, status: "framework_offered" }),
    "opening_click",
  );
  assertEquals(
    resolveGetFrameworkPostbackRoute({ dm_flow_version: 2, status: "follow_gate_sent" }),
    "noop",
  );
  assertEquals(
    resolveGetFrameworkPostbackRoute({ dm_flow_version: 2, status: "delivered" }),
    "noop",
  );
});

Deno.test("resolveGetFrameworkPostbackRoute — v1 legacy", () => {
  assertEquals(
    resolveGetFrameworkPostbackRoute({ dm_flow_version: 1, status: "framework_offered" }),
    "legacy_delivery",
  );
  assertEquals(
    resolveGetFrameworkPostbackRoute({ dm_flow_version: 1, status: "follow_validated" }),
    "legacy_framework_offer",
  );
});

Deno.test("resolveFollowConfirmPostbackRoute — v2", () => {
  assertEquals(
    resolveFollowConfirmPostbackRoute({ dm_flow_version: 2, status: "framework_offered" }),
    "resend_opening",
  );
  assertEquals(
    resolveFollowConfirmPostbackRoute({ dm_flow_version: 2, status: "follow_validated" }),
    "resend_delivery",
  );
  assertEquals(
    resolveFollowConfirmPostbackRoute({ dm_flow_version: 2, status: "follow_gate_sent" }),
    "handle_confirm",
  );
});

Deno.test("resolveFollowConfirmPostbackRoute — v1 legacy", () => {
  assertEquals(
    resolveFollowConfirmPostbackRoute({ dm_flow_version: 1, status: "framework_offered" }),
    "resend_legacy_offer",
  );
  assertEquals(
    resolveFollowConfirmPostbackRoute({ dm_flow_version: 1, status: "follow_gate_sent" }),
    "handle_confirm",
  );
});
