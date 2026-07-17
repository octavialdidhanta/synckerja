import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveFlowBranch, getMissingContactFields } from "./skipMatrix.ts";
import { parseContactReply } from "./parseContactReply.ts";
import { contactPromptForMissing } from "./contactGatePrompt.ts";
import { isPostContactGateEnrollmentStatus } from "../followGateRuntime.ts";

Deno.test("skipMatrix complete profile", () => {
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: true },
    profile: { phone_number: "6281", email: "a@b.com" },
    isFollower: true,
  });
  assertEquals(branch.branch, "deliver_instagram");
});

Deno.test("skipMatrix phone only needs email on next enrollment", () => {
  assertEquals(
    getMissingContactFields({ phone_number: "6281286663811", email: null }),
    "email",
  );
  const branch = resolveFlowBranch({
    campaign: { contact_gate_enabled: true },
    profile: { phone_number: "6281286663811", email: null },
    isFollower: true,
  });
  assertEquals(branch.branch, "needs_contact");
  if (branch.branch === "needs_contact") {
    assertEquals(branch.ask, "email");
  }
});

Deno.test("skipMatrix email only needs phone", () => {
  assertEquals(
    getMissingContactFields({ phone_number: null, email: "user@example.com" }),
    "phone",
  );
});

Deno.test("parseContactReply phone", () => {
  const r = parseContactReply("08123456789");
  assertEquals(r.kind, "phone");
});

Deno.test("parseContactReply email", () => {
  const r = parseContactReply("oktavialdidhanta@gmail.com");
  assertEquals(r.kind, "email");
  if (r.kind === "email") {
    assertEquals(r.normalized, "oktavialdidhanta@gmail.com");
  }
});

Deno.test("getMissingContactFields any", () => {
  assertEquals(getMissingContactFields({ phone_number: null, email: null }), "any");
});

Deno.test("contactPromptForMissing email uses dedicated template", () => {
  const text = contactPromptForMissing(
    { contact_gate_enabled: true } as Parameters<typeof contactPromptForMissing>[0],
    "email",
    "testuser",
  );
  assertEquals(text.includes("email Anda"), true);
  assertEquals(text.includes("testuser"), true);
});

Deno.test("delivered_whatsapp is terminal post-contact gate status", () => {
  assertEquals(isPostContactGateEnrollmentStatus("delivered_whatsapp"), true);
  assertEquals(isPostContactGateEnrollmentStatus("delivered_email"), true);
  assertEquals(isPostContactGateEnrollmentStatus("awaiting_contact"), true);
  assertEquals(isPostContactGateEnrollmentStatus("comment_replied"), false);
});

Deno.test("returning profile phone-only: email ask applies at new enrollment entry", () => {
  const missing = getMissingContactFields({
    phone_number: "6281286663811",
    email: null,
  });
  const parsed = parseContactReply("oktavialdidhanta@gmail.com");
  assertEquals(missing, "email");
  assertEquals(parsed.kind, "email");
});
