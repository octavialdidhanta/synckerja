import { describe, expect, it } from "vitest";
import { signConfirmation } from "../src/tools/inventory/confirmation";
import { signContentConfirmation, verifyContentConfirmation } from "../src/tools/content/contentConfirmation";
import { briefPreviewArgs, briefUpdateFromConfirmation, updateBriefPreviewInput } from "../src/tools/content/briefsUpdate";

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

describe("content.briefs.update.preview scene input", () => {
  const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
  const shot_id = "11111111-1111-4111-8111-111111111111";

  it("accepts scene and sends it as the scene cell", () => {
    const parsed = updateBriefPreviewInput.safeParse({ id, base_version: 0, shots: [{ shot_id, scene: "piring" }] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(briefPreviewArgs(parsed.data).shots?.[0]).toMatchObject({ shotId: shot_id, visual: "piring" });
  });

  it("rejects scene and visual with different text", () => {
    expect(
      updateBriefPreviewInput.safeParse({ id, base_version: 0, shots: [{ shot_id, scene: "a", visual: "b" }] }).success,
    ).toBe(false);
  });
});
