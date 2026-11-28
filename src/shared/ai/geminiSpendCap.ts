export const GEMINI_SPEND_CAP_URL = "https://ai.studio/spend";
export const GEMINI_PREPAID_URL = "https://ai.studio/projects";

const SPEND_CAP_NEEDLE = "monthly spending cap";
const PREPAID_NEEDLE = "prepayment credits are depleted";

/** ElevenLabs billing page (generate-brief-voice answers code voice_credit_exhausted when the balance is spent). */
export const ELEVENLABS_BILLING_URL = "https://elevenlabs.io/app/subscription";
const ELEVENLABS_CREDIT_NEEDLE = "kredit elevenlabs habis";

/** One shared billing dialog: Gemini spend cap or prepaid credits, and ElevenLabs credits for voice over. */
export type GeminiBillingNotice =
  | "spend_cap"
  | "prepaid"
  | "elevenlabs"
  | "anthropic_credit"
  | "anthropic_limit"
  | "anthropic_billing";

/** Claude Console pages for the Agent's footage tagging (Agent heartbeat tools.anthropic_credit). */
export const ANTHROPIC_BILLING_URL = "https://console.anthropic.com/settings/billing";
export const ANTHROPIC_LIMITS_URL = "https://console.anthropic.com/settings/limits";

export type AnthropicCreditKind = "credit" | "spend_limit" | "billing";

/** Where the Anthropic refusal came from, so the dialog explains what stopped and how it resumes. */
export type AnthropicCreditSource = "agent" | "lead_magnet";

let anthropicSource: AnthropicCreditSource = "agent";

export function anthropicCreditSource(): AnthropicCreditSource {
  return anthropicSource;
}

/**
 * Opens the shared dialog when Anthropic credits, spend limit or payment block a Claude call:
 * the Agent's footage tagging (heartbeat) or the Lead Magnet PDF (edge function codes anthropic_*).
 */
export function presentAnthropicCredit(kind: AnthropicCreditKind, source: AnthropicCreditSource = "agent"): void {
  if (notice) return;
  anthropicSource = source;
  openGeminiBillingNotice(
    kind === "spend_limit" ? "anthropic_limit" : kind === "billing" ? "anthropic_billing" : "anthropic_credit",
  );
}

/** Edge function codes anthropic_credit / anthropic_limit / anthropic_billing → kind; anything else → null. */
export function anthropicCreditKindFromCode(code: string | null | undefined): AnthropicCreditKind | null {
  if (code === "anthropic_credit") return "credit";
  if (code === "anthropic_limit") return "spend_limit";
  if (code === "anthropic_billing") return "billing";
  return null;
}

export function isElevenLabsCreditMessage(text: string | null | undefined): boolean {
  return typeof text === "string" && text.toLowerCase().includes(ELEVENLABS_CREDIT_NEEDLE);
}

export function isGeminiSpendCapMessage(text: string | null | undefined): boolean {
  return typeof text === "string" && text.toLowerCase().includes(SPEND_CAP_NEEDLE);
}

export function isGeminiPrepaidDepletedMessage(text: string | null | undefined): boolean {
  return typeof text === "string" && text.toLowerCase().includes(PREPAID_NEEDLE);
}

export function isGeminiBillingNoticeMessage(text: string | null | undefined): boolean {
  return isGeminiSpendCapMessage(text) || isGeminiPrepaidDepletedMessage(text);
}

export class GeminiSpendCapError extends Error {
  constructor(message = "Your project has exceeded its monthly spending cap.") {
    super(message);
    this.name = "GeminiSpendCapError";
  }
}

export function isGeminiSpendCapError(error: unknown): boolean {
  if (error instanceof GeminiSpendCapError) return true;
  return error instanceof Error && isGeminiSpendCapMessage(error.message);
}

export class GeminiPrepaidDepletedError extends Error {
  constructor(message = "Your prepayment credits are depleted.") {
    super(message);
    this.name = "GeminiPrepaidDepletedError";
  }
}

export function isGeminiPrepaidDepletedError(error: unknown): boolean {
  if (error instanceof GeminiPrepaidDepletedError) return true;
  return error instanceof Error && isGeminiPrepaidDepletedMessage(error.message);
}

export function isGeminiBillingNoticeError(error: unknown): boolean {
  return isGeminiSpendCapError(error) || isGeminiPrepaidDepletedError(error);
}

type SpendCapListener = (open: boolean) => void;

let notice: GeminiBillingNotice | null = null;
const listeners = new Set<SpendCapListener>();

export function subscribeGeminiSpendCap(listener: SpendCapListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function geminiBillingNotice(): GeminiBillingNotice | null {
  return notice;
}

export function geminiSpendCapDialogOpen(): boolean {
  return notice !== null;
}

function openGeminiBillingNotice(kind: GeminiBillingNotice): void {
  if (notice) return;
  notice = kind;
  for (const listener of listeners) listener(true);
}

export function openGeminiSpendCapDialog(): void {
  openGeminiBillingNotice("spend_cap");
}

export function closeGeminiSpendCapDialog(): void {
  if (!notice) return;
  notice = null;
  for (const listener of listeners) listener(false);
}

/** Opens the shared dialog when ElevenLabs refuses a voice over because the organization's credits are spent. */
export function presentElevenLabsCredit(text: string | null | undefined): boolean {
  if (!isElevenLabsCreditMessage(text)) return false;
  openGeminiBillingNotice("elevenlabs");
  return true;
}

/** Opens the shared dialog when Google blocks the request for spend cap or depleted prepayment credits. */
export function presentGeminiSpendCap(text: string | null | undefined): boolean {
  if (isGeminiSpendCapMessage(text)) {
    openGeminiBillingNotice("spend_cap");
    return true;
  }
  if (isGeminiPrepaidDepletedMessage(text)) {
    openGeminiBillingNotice("prepaid");
    return true;
  }
  return false;
}

function errorField(data: unknown): string {
  if (!data || typeof data !== "object" || !("error" in data)) return "";
  const value = (data as { error?: unknown }).error;
  return typeof value === "string" ? value : "";
}

/**
 * Supabase `functions.invoke` often replaces the JSON body with
 * "Edge Function returned a non-2xx status code". Read the body first.
 */
export async function readEdgeFunctionError(data: unknown, error: unknown): Promise<string> {
  const fromData = errorField(data).trim();
  if (fromData) return fromData;
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : undefined;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      const fromBody = errorField(body).trim();
      if (fromBody) return fromBody;
    } catch {
      // The body was already consumed or was not JSON.
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "";
}
