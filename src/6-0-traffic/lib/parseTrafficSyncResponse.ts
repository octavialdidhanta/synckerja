export type TrafficSyncResponseBody = {
  success?: unknown;
  ok?: unknown;
  message?: unknown;
  error?: unknown;
  step?: unknown;
  hint_sql?: unknown;
  hint?: unknown;
};

export function parseTrafficSyncResponse(text: string): TrafficSyncResponseBody | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as TrafficSyncResponseBody) : null;
  } catch {
    return null;
  }
}

export function formatTrafficSyncErrorMessage(
  parsed: TrafficSyncResponseBody | null,
  text: string,
  fallbackStatusText?: string,
): string {
  const m = parsed?.message ?? parsed?.error ?? (typeof text === "string" && text.trim() ? text : null);
  const step = parsed?.step ? String(parsed.step) : "";
  const hint = parsed?.hint_sql ?? parsed?.hint;
  const base = m == null ? "Edge runtime error" : String(m);
  const withStep = step ? `[${step}] ${base}` : base;
  return hint ? `${withStep} — ${String(hint)}` : withStep || fallbackStatusText || "Unknown error";
}
