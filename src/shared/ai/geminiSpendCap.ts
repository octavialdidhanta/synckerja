export const GEMINI_SPEND_CAP_URL = "https://ai.studio/spend";

const SPEND_CAP_NEEDLE = "monthly spending cap";

export function isGeminiSpendCapMessage(text: string | null | undefined): boolean {
  return typeof text === "string" && text.toLowerCase().includes(SPEND_CAP_NEEDLE);
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

type SpendCapListener = (open: boolean) => void;

let dialogOpen = false;
const listeners = new Set<SpendCapListener>();

export function subscribeGeminiSpendCap(listener: SpendCapListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function geminiSpendCapDialogOpen(): boolean {
  return dialogOpen;
}

export function openGeminiSpendCapDialog(): void {
  if (dialogOpen) return;
  dialogOpen = true;
  for (const listener of listeners) listener(true);
}

export function closeGeminiSpendCapDialog(): void {
  if (!dialogOpen) return;
  dialogOpen = false;
  for (const listener of listeners) listener(false);
}

/** Opens the shared dialog when Google reports the monthly project spend cap. */
export function presentGeminiSpendCap(text: string | null | undefined): boolean {
  if (!isGeminiSpendCapMessage(text)) return false;
  openGeminiSpendCapDialog();
  return true;
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
