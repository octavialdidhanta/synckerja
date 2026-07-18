import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveFlowBranch,
  isEmailCollectionEnabled,
  isAnyContactFlowActive,
} from "./skipMatrix.ts";
import { parseContactReply } from "./parseContactReply.ts";
import { contactPromptForMissing } from "./contactGatePrompt.ts";
import { isPostContactGateEnrollmentStatus } from "../followGateRuntime.ts";

Deno.test("skipMatrix email collection: new user needs email", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: false, email_collection_enabled: true },
    profile: { phone_number: null, email: null },
    isFollower: true,
  });
  assertEquals(branch.branch, "needs_contact");
  if (branch.branch === "needs_contact") {
    assertEquals(branch.ask, "email");
  }
});

Deno.test("skipMatrix returning user with email needs phone when WA gate on", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: true, email_collection_enabled: true },
    profile: { phone_number: null, email: "user@example.com" },
    isFollower: true,
  });
  assertEquals(branch.branch, "needs_contact");
  if (branch.branch === "needs_contact") {
    assertEquals(branch.ask, "phone");
  }
});

Deno.test("skipMatrix complete profile delivers instagram", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: true, email_collection_enabled: true },
    profile: { phone_number: "6281", email: "a@b.com" },
    isFollower: true,
  });
  assertEquals(branch.branch, "deliver_instagram");
});

Deno.test("skipMatrix no gates uses legacy delivery", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: false, email_collection_enabled: false },
    profile: { phone_number: null, email: null },
    isFollower: true,
  });
  assertEquals(branch.branch, "legacy_material_or_delivery");
});

Deno.test("skipMatrix non follower needs follow gate", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: true, email_collection_enabled: true },
    profile: { phone_number: null, email: null },
    isFollower: false,
  });
  assertEquals(branch.branch, "needs_follow_gate");
});

Deno.test("parseContactReply email", () => {
  const r = parseContactReply("oktavialdidhanta@gmail.com");
  assertEquals(r.kind, "email");
});

Deno.test("contactPromptForMissing email uses campaign prompt", () => {
  const text = contactPromptForMissing(
    {
      contact_gate_enabled: true,
      email_collection_enabled: true,
      contact_prompt_text: "Hi {{username}} send email",
    } as Parameters<typeof contactPromptForMissing>[0],
    "email",
    "testuser",
  );
  assertEquals(text.includes("testuser"), true);
  assertEquals(text.includes("send email"), true);
});

Deno.test("isAnyContactFlowActive", () => {
  assertEquals(
    isAnyContactFlowActive({ contact_gate_enabled: false, email_collection_enabled: true }),
    true,
  );
  assertEquals(isEmailCollectionEnabled({ email_collection_enabled: true }), true);
});

Deno.test("delivered_whatsapp is terminal post-contact gate status", () => {
  assertEquals(isPostContactGateEnrollmentStatus("delivered_whatsapp"), true);
  assertEquals(isPostContactGateEnrollmentStatus("awaiting_contact"), true);
});
