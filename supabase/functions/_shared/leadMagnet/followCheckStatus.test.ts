import {
  isConsentRequiredMetaError,
  needsMessagingConsentRecheck,
  resolveFollowStatus,
  shouldAdvanceFollowConfirm,
  shouldSkipFollowGate,
} from "./followCheckStatus.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("resolveFollowStatus — true is always follower", () => {
  assertEquals(resolveFollowStatus(true), "follower");
  assertEquals(resolveFollowStatus(true, { messagingWindowOpen: false }), "follower");
});

Deno.test("resolveFollowStatus — false before messaging window is unknown", () => {
  assertEquals(resolveFollowStatus(false), "unknown");
  assertEquals(resolveFollowStatus(false, { messagingWindowOpen: false }), "unknown");
});

Deno.test("resolveFollowStatus — false after messaging window is non_follower", () => {
  assertEquals(resolveFollowStatus(false, { messagingWindowOpen: true }), "non_follower");
});

Deno.test("shouldSkipFollowGate — gate OFF always skips; gate ON skips only follower", () => {
  const gateOff = { skip_follow_gate_if_follower: true };
  assertEquals(shouldSkipFollowGate(gateOff, "follower"), true);
  assertEquals(shouldSkipFollowGate(gateOff, "non_follower"), true);
  assertEquals(shouldSkipFollowGate(gateOff, "unknown"), true);

  const gateOn = { skip_follow_gate_if_follower: false };
  assertEquals(shouldSkipFollowGate(gateOn, "follower"), true);
  assertEquals(shouldSkipFollowGate(gateOn, "non_follower"), false);
  assertEquals(shouldSkipFollowGate(gateOn, "unknown"), false);
});

Deno.test("needsMessagingConsentRecheck — IG first contact + gate ON + not follower", () => {
  const gateOn = { skip_follow_gate_if_follower: false };
  const gateOff = { skip_follow_gate_if_follower: true };
  const enrollment = {
    platform: "instagram" as const,
    comment_id: "cmt-1",
    private_reply_message_id: null,
  };
  assertEquals(needsMessagingConsentRecheck(enrollment, gateOn, "unknown"), true);
  assertEquals(needsMessagingConsentRecheck(enrollment, gateOn, "non_follower"), true);
  assertEquals(needsMessagingConsentRecheck(enrollment, gateOn, "follower"), false);
  assertEquals(needsMessagingConsentRecheck(enrollment, gateOff, "unknown"), false);
  assertEquals(
    needsMessagingConsentRecheck(
      { ...enrollment, private_reply_message_id: "msg-1" },
      gateOn,
      "unknown",
    ),
    false,
  );
  assertEquals(
    needsMessagingConsentRecheck(
      { ...enrollment, platform: "facebook" },
      gateOn,
      "unknown",
    ),
    false,
  );
});

Deno.test("isConsentRequiredMetaError — detects consent errors", () => {
  assertEquals(isConsentRequiredMetaError({ message: "User consent is required" }), true);
  assertEquals(isConsentRequiredMetaError({ code: 230 }), true);
  assertEquals(isConsentRequiredMetaError({ message: "Other error" }), false);
});

Deno.test("shouldAdvanceFollowConfirm — only follower advances (no honor bypass)", () => {
  assertEquals(shouldAdvanceFollowConfirm("follower"), true);
  assertEquals(shouldAdvanceFollowConfirm("non_follower"), false);
  assertEquals(shouldAdvanceFollowConfirm("unknown"), false);
});
