/**
 * Google AI Studio refusals that no retry fixes until the owner acts there:
 * - spend_cap: "Your project has exceeded its monthly spending cap…" (ai.studio/spend)
 * - prepaid: "Your prepayment credits are depleted…" (ai.studio/projects)
 * Same idea as _shared/anthropicCredit.ts: a stable code plus an Indonesian message instead of Google's English.
 * The Office (src/shared/ai/geminiSpendCap.ts) opens the shared billing dialog from the code or the message.
 */

export type GeminiBillingKind = "spend_cap" | "prepaid";

export interface GeminiBillingProblem {
  kind: GeminiBillingKind;
  code: "gemini_spend_cap" | "gemini_prepaid";
  message: string;
}

/** Google's English sentence, or our own Indonesian message when it is passed along again. */
const SPEND_CAP = /monthly spending cap|batas belanja gemini/i;
const PREPAID = /prepayment credits are depleted|kredit gemini habis/i;

/** Pass Google's error message or the raw response body. */
export function geminiBillingProblem(text: string | null | undefined): GeminiBillingProblem | null {
  const value = String(text ?? "");
  if (SPEND_CAP.test(value)) {
    return {
      kind: "spend_cap",
      code: "gemini_spend_cap",
      message: "Batas belanja Gemini tercapai. Naikkan batasnya di Google AI Studio, lalu coba lagi.",
    };
  }
  if (PREPAID.test(value)) {
    return {
      kind: "prepaid",
      code: "gemini_prepaid",
      message: "Kredit Gemini habis. Isi ulang kredit prabayar di Google AI Studio, lalu coba lagi.",
    };
  }
  return null;
}
