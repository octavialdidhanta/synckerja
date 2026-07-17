import {
  isConsentRequiredMetaError,
  needsMessagingConsentRecheck,
  resolveFollowStatus,
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

Deno.test("shouldSkipFollowGate — only when skip enabled and follower", () => {
  const campaign = { skip_follow_gate_if_follower: true };
  assertEquals(shouldSkipFollowGate(campaign, "follower"), true);
  assertEquals(shouldSkipFollowGate(campaign, "non_follower"), false);
  assertEquals(shouldSkipFollowGate(campaign, "unknown"), false);
  assertEquals(shouldSkipFollowGate({ skip_follow_gate_if_follower: false }, "follower"), false);
});

Deno.test("needsMessagingConsentRecheck — IG first contact + skip + not follower", () => {
  const campaign = { skip_follow_gate_if_follower: true };
  const enrollment = {
    platform: "instagram" as const,
    comment_id: "cmt-1",
    private_reply_message_id: null,
  };
  assertEquals(needsMessagingConsentRecheck(enrollment, campaign, "unknown"), true);
  assertEquals(needsMessagingConsentRecheck(enrollment, campaign, "non_follower"), true);
  assertEquals(needsMessagingConsentRecheck(enrollment, campaign, "follower"), false);
  assertEquals(
    needsMessagingConsentRecheck(
      { ...enrollment, private_reply_message_id: "msg-1" },
      campaign,
      "unknown",
    ),
    false,
  );
  assertEquals(
    needsMessagingConsentRecheck(
      { ...enrollment, platform: "facebook" },
      campaign,
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
