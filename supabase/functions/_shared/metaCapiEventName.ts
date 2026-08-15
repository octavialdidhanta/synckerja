/** Sanitize Meta CAPI event_name from org settings (standard or custom). */

export const META_CAPI_DEFAULT_EVENT_NAME = "Purchase";
export const META_CAPI_EVENT_NAME_MAX_LENGTH = 64;

export function sanitizeMetaCapiEventName(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return META_CAPI_DEFAULT_EVENT_NAME;
  if (trimmed.length > META_CAPI_EVENT_NAME_MAX_LENGTH) {
    return trimmed.slice(0, META_CAPI_EVENT_NAME_MAX_LENGTH);
  }
  return trimmed;
}

export function validateMetaCapiEventNameForUpsert(
  raw: string | null | undefined,
): { ok: true; eventName: string } | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: true, eventName: META_CAPI_DEFAULT_EVENT_NAME };
  }
  if (trimmed.length > META_CAPI_EVENT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `default_event_name must be at most ${META_CAPI_EVENT_NAME_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, eventName: trimmed };
}
