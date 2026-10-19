import { afterEach, describe, expect, it } from "vitest";
import {
  closeGeminiSpendCapDialog,
  geminiSpendCapDialogOpen,
  isGeminiSpendCapMessage,
  presentGeminiSpendCap,
} from "@/shared/ai/geminiSpendCap";

const GOOGLE_SPEND_CAP =
  "Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap. Learn more at https://ai.google.dev/gemini-api/docs/billing#project-spend-caps.";

describe("gemini spend cap", () => {
  afterEach(() => {
    closeGeminiSpendCapDialog();
  });

  it("matches the Google monthly spend cap sentence", () => {
    expect(isGeminiSpendCapMessage(GOOGLE_SPEND_CAP)).toBe(true);
  });

  it("ignores an ordinary AI error", () => {
    expect(isGeminiSpendCapMessage("No content generated from AI")).toBe(false);
    expect(isGeminiSpendCapMessage(null)).toBe(false);
  });

  it("opens one dialog when several requests fail together", () => {
    expect(presentGeminiSpendCap(GOOGLE_SPEND_CAP)).toBe(true);
    expect(geminiSpendCapDialogOpen()).toBe(true);
    expect(presentGeminiSpendCap(GOOGLE_SPEND_CAP)).toBe(true);
    expect(geminiSpendCapDialogOpen()).toBe(true);
    expect(presentGeminiSpendCap("No content generated from AI")).toBe(false);
  });
});
