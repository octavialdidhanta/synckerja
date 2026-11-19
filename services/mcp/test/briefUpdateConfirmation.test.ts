import { describe, expect, it } from "vitest";
import { signConfirmation } from "../src/tools/inventory/confirmation";
import { signContentConfirmation, verifyContentConfirmation } from "../src/tools/content/contentConfirmation";
import { briefUpdateFromConfirmation } from "../src/tools/content/briefsUpdate";

const secret = "content-brief-confirm-test";
const identity = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const write = {
  planId: "33333333-3333-4333-8333-333333333333",
  baseVersion: 2,
  brief: "| Timing | VO (Voice Over) |\n| --- | --- |\n| Slide 1 | Hai |",
  concept: "{\"v\":1,\"voiceOver\":\"Hai\"}",
  caption: "caption baru",
  link: "https://example.com",
};

describe("content brief confirmation", () => {
  it("returns the text that was signed", async () => {
    const signed = await signContentConfirmation(secret, identity, "content.briefs.update", { ...write });
    const verified = await verifyContentConfirmation(secret, identity, "content.briefs.update", signed.confirm_token);
    expect(briefUpdateFromConfirmation(verified.payload)).toEqual(write);
  });

  it("rejects a token signed for another tool", async () => {
    const inventory = await signConfirmation(secret, identity, "inventory.adjustment.create", { qtyChange: 1 });
    await expect(
      verifyContentConfirmation(secret, identity, "content.briefs.update", inventory.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
  });
});
