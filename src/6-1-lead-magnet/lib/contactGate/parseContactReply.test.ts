import { describe, expect, it } from "vitest";
import { parseContactReply } from "../../../../supabase/functions/_shared/leadMagnet/contactGate/parseContactReply.ts";

describe("parseContactReply", () => {
  it("parses Indonesian phone", () => {
    const r = parseContactReply("081234567890");
    expect(r.kind).toBe("phone");
    if (r.kind === "phone") expect(r.normalized).toBe("6281234567890");
  });

  it("parses email", () => {
    const r = parseContactReply("email saya nama@example.com");
    expect(r.kind).toBe("email");
    if (r.kind === "email") expect(r.normalized).toBe("nama@example.com");
  });

  it("prefers phone when both present", () => {
    const r = parseContactReply("6281234567890 dan email@test.com");
    expect(r.kind).toBe("phone");
  });

  it("invalid for empty or garbage", () => {
    expect(parseContactReply("").kind).toBe("invalid");
    expect(parseContactReply("halo").kind).toBe("invalid");
  });
});
