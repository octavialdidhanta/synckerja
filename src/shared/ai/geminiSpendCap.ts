export const GEMINI_SPEND_CAP_URL = "https://ai.studio/spend";
export const GEMINI_PREPAID_URL = "https://ai.studio/projects";

const SPEND_CAP_NEEDLE = "monthly spending cap";
const PREPAID_NEEDLE = "prepayment credits are depleted";

export type GeminiBillingNotice = "spend_cap" | "prepaid";

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
