/**
 * Anthropic refusals that no retry fixes until the owner acts in the Claude Console
 * (same rules as the Synckerja Agent, src/tag/aiCredit.ts):
 * - credit: HTTP 400 invalid_request_error "Your credit balance is too low to access the Anthropic API…"
 * - spend_limit: HTTP 429 rate_limit_error "You have reached your specified (workspace) API usage limits…",
 *   details.error_code "enforced_spend_limit_reached".
 * - billing: HTTP 402 billing_error (payment details).
 */

export type AnthropicCreditKind = "credit" | "spend_limit" | "billing";

/** Response codes for the Office: they match the shared billing dialog notices. */
export const ANTHROPIC_CREDIT_CODE: Record<AnthropicCreditKind, string> = {
  credit: "anthropic_credit",
  spend_limit: "anthropic_limit",
  billing: "anthropic_billing",
};

const MESSAGE: Record<AnthropicCreditKind, string> = {
  credit: "Kredit Anthropic habis. Isi kredit di Claude Console (Billing), lalu simpan lagi.",
  spend_limit: "Batas belanja Anthropic tercapai. Naikkan batasnya di Claude Console (Limits), lalu simpan lagi.",
  billing: "Pembayaran Anthropic bermasalah. Periksa metode pembayaran di Claude Console (Billing), lalu simpan lagi.",
};

export class AnthropicCreditError extends Error {
  readonly code: string;
  constructor(readonly kind: AnthropicCreditKind, readonly raw: string) {
    super(MESSAGE[kind]);
    this.name = "AnthropicCreditError";
    this.code = ANTHROPIC_CREDIT_CODE[kind];
  }
}

export function classifyAnthropicError(status: number, bodyText: string): AnthropicCreditKind | null {
  let type = "";
  let message = "";
  let code = "";
  try {
    const body = JSON.parse(bodyText) as {
      error?: { type?: string; message?: string; details?: { error_code?: string } };
    };
    type = String(body.error?.type ?? "");
    message = String(body.error?.message ?? "");
    code = String(body.error?.details?.error_code ?? "");
  } catch {
    message = bodyText;
  }
  if (/credit balance is too low/i.test(message)) return "credit";
  if (
    code === "enforced_spend_limit_reached" ||
    /reached your specified (workspace )?API usage limits|reached your API usage limits/i.test(message)
  ) {
    return "spend_limit";
  }
  if (status === 402 || type === "billing_error") return "billing";
  return null;
}

/** Message from an Anthropic error body, for errors that are not about credits. */
export function anthropicErrorMessage(bodyText: string): string {
  try {
    const body = JSON.parse(bodyText) as { error?: { message?: string } };
    return String(body.error?.message ?? "").trim();
  } catch {
    return bodyText.trim();
  }
}
