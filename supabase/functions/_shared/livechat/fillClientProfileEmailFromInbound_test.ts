import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractEmailFromMessageBody } from "../leadMagnet/contactGate/parseContactReply.ts";
import {
  deriveLivechatTicketId,
  hasEmailValue,
  pickSubmissionForEmailFill,
  resolveCanonicalEmailForFill,
  type SubmissionRowForEmailFill,
} from "./fillClientProfileEmailFromInbound.ts";

Deno.test("extractEmailFromMessageBody bare email", () => {
  assertEquals(extractEmailFromMessageBody("user@example.com"), "user@example.com");
});

Deno.test("extractEmailFromMessageBody email mid-sentence with punctuation", () => {
  assertEquals(
    extractEmailFromMessageBody("Halo, email saya User@Example.COM. Terima kasih"),
    "user@example.com",
  );
  assertEquals(
    extractEmailFromMessageBody("kontak: (budi.santoso@mail.co.id), ya"),
    "budi.santoso@mail.co.id",
  );
});

Deno.test("extractEmailFromMessageBody email alongside phone still returns email", () => {
  assertEquals(
    extractEmailFromMessageBody("hp 081234567890 email budi@mail.com"),
    "budi@mail.com",
  );
});

Deno.test("extractEmailFromMessageBody no email returns null", () => {
  assertEquals(extractEmailFromMessageBody("halo apakah masih tersedia?"), null);
  assertEquals(extractEmailFromMessageBody("081234567890"), null);
  assertEquals(extractEmailFromMessageBody(""), null);
  assertEquals(extractEmailFromMessageBody(null), null);
  assertEquals(extractEmailFromMessageBody("harga @ 500.000"), null);
});

Deno.test("extractEmailFromMessageBody rejects overlong email", () => {
  const local = "a".repeat(260);
  assertEquals(extractEmailFromMessageBody(`${local}@mail.com`), null);
});

Deno.test("resolveCanonicalEmailForFill keeps existing submission email", () => {
  assertEquals(
    resolveCanonicalEmailForFill({
      submissionEmail: "existing@mail.com",
      leadEmail: null,
      detectedEmail: "new@mail.com",
    }),
    "existing@mail.com",
  );
});

Deno.test("resolveCanonicalEmailForFill falls back lead then WA profile then detected", () => {
  assertEquals(
    resolveCanonicalEmailForFill({
      submissionEmail: "  ",
      leadEmail: "lead@mail.com",
      detectedEmail: "new@mail.com",
    }),
    "lead@mail.com",
  );
  assertEquals(
    resolveCanonicalEmailForFill({
      submissionEmail: null,
      leadEmail: "",
      waProfileEmail: "wa@mail.com",
      detectedEmail: "new@mail.com",
    }),
    "wa@mail.com",
  );
  assertEquals(
    resolveCanonicalEmailForFill({
      submissionEmail: null,
      leadEmail: null,
      waProfileEmail: null,
      detectedEmail: "new@mail.com",
    }),
    "new@mail.com",
  );
});

Deno.test("resolveCanonicalEmailForFill is idempotent on reprocessing", () => {
  // After the first fill the detected email is stored, so a second run resolves to the same value.
  const first = resolveCanonicalEmailForFill({ detectedEmail: "new@mail.com" });
  const second = resolveCanonicalEmailForFill({
    submissionEmail: first,
    detectedEmail: "other@mail.com",
  });
  assertEquals(second, "new@mail.com");
});

Deno.test("pickSubmissionForEmailFill prefers latest submitted over draft", () => {
  const rows: SubmissionRowForEmailFill[] = [
    { id: "d1", email: null, status: "draft", submitted_at: null, updated_at: "2026-07-25" },
    { id: "s1", email: null, status: "submitted", submitted_at: "2026-07-01", updated_at: "2026-07-01" },
    { id: "s2", email: null, status: "submitted", submitted_at: "2026-07-10", updated_at: "2026-07-10" },
  ];
  assertEquals(pickSubmissionForEmailFill(rows)?.id, "s2");
});

Deno.test("pickSubmissionForEmailFill uses latest draft when no submitted", () => {
  const rows: SubmissionRowForEmailFill[] = [
    { id: "d1", email: null, status: "draft", submitted_at: null, updated_at: "2026-07-01" },
    { id: "d2", email: null, status: "draft", submitted_at: null, updated_at: "2026-07-10" },
  ];
  assertEquals(pickSubmissionForEmailFill(rows)?.id, "d2");
});

Deno.test("pickSubmissionForEmailFill skips inactive rows and handles empty", () => {
  const rows: SubmissionRowForEmailFill[] = [
    { id: "s1", email: null, status: "submitted", submitted_at: "2026-07-10", updated_at: "2026-07-10", is_active: false },
  ];
  assertEquals(pickSubmissionForEmailFill(rows), null);
  assertEquals(pickSubmissionForEmailFill([]), null);
});

Deno.test("hasEmailValue", () => {
  assertEquals(hasEmailValue("a@b.co"), true);
  assertEquals(hasEmailValue("   "), false);
  assertEquals(hasEmailValue(null), false);
  assertEquals(hasEmailValue(undefined), false);
});

Deno.test("deriveLivechatTicketId matches conversation ticket convention", () => {
  const convId = "1c9f4a2b-3d5e-4f60-8a7b-9c0d1e2f3a4b";
  assertEquals(deriveLivechatTicketId("whatsapp", convId), "WA-1C9F4A2B");
  assertEquals(deriveLivechatTicketId("instagram", convId), "IG-1C9F4A2B");
  assertEquals(deriveLivechatTicketId("facebook", convId), "FB-1C9F4A2B");
});
