import { afterEach, describe, expect, it } from "vitest";
import { geminiBillingProblem } from "../../../supabase/functions/_shared/geminiBilling.ts";
import {
  closeGeminiSpendCapDialog,
  geminiBillingNotice,
  isGeminiPrepaidDepletedMessage,
  isGeminiSpendCapMessage,
  presentGeminiSpendCap,
} from "@/shared/ai/geminiSpendCap";

const SPEND_CAP = "Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.";
const PREPAID = "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.";

describe("Gemini billing refusals from edge functions", () => {
  afterEach(() => closeGeminiSpendCapDialog());

  it("turns Google's sentences into a code and an Indonesian message", () => {
    expect(geminiBillingProblem(SPEND_CAP)).toMatchObject({ kind: "spend_cap", code: "gemini_spend_cap" });
    expect(geminiBillingProblem(SPEND_CAP)?.message).toMatch(/^Batas belanja Gemini tercapai/);
    expect(geminiBillingProblem(PREPAID)).toMatchObject({ kind: "prepaid", code: "gemini_prepaid" });
    expect(geminiBillingProblem(JSON.stringify({ error: { code: 429, message: SPEND_CAP, status: "RESOURCE_EXHAUSTED" } }))?.kind).toBe("spend_cap");
    expect(geminiBillingProblem("Resource has been exhausted (e.g. check quota).")).toBeNull();
    expect(geminiBillingProblem("The model is overloaded. Please try again later.")).toBeNull();
    expect(geminiBillingProblem(null)).toBeNull();
  });

  it("recognises its own Indonesian message when passed along again", () => {
    const spend = geminiBillingProblem(SPEND_CAP)!;
    const prepaid = geminiBillingProblem(PREPAID)!;
    expect(geminiBillingProblem(spend.message)?.code).toBe("gemini_spend_cap");
    expect(geminiBillingProblem(prepaid.message)?.code).toBe("gemini_prepaid");
  });

  it("Office opens the shared dialog for the Indonesian messages", () => {
    const spend = geminiBillingProblem(SPEND_CAP)!.message;
    const prepaid = geminiBillingProblem(PREPAID)!.message;
    expect(isGeminiSpendCapMessage(spend)).toBe(true);
    expect(isGeminiPrepaidDepletedMessage(spend)).toBe(false);
    expect(isGeminiPrepaidDepletedMessage(prepaid)).toBe(true);
    expect(isGeminiSpendCapMessage("Kredit ElevenLabs habis")).toBe(false);

    expect(presentGeminiSpendCap(prepaid)).toBe(true);
    expect(geminiBillingNotice()).toBe("prepaid");
    closeGeminiSpendCapDialog();
    expect(presentGeminiSpendCap(spend)).toBe(true);
    expect(geminiBillingNotice()).toBe("spend_cap");
    closeGeminiSpendCapDialog();
    expect(presentGeminiSpendCap(undefined)).toBe(false);
  });
});
