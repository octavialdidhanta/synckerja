import {
  META_CAPI_CUSTOM_EVENT_MAX_LENGTH,
  META_CAPI_CUSTOM_EVENT_VALUE,
  META_CAPI_DEFAULT_EVENT_NAME,
  META_CAPI_STANDARD_EVENTS,
  type MetaCapiStandardEvent,
} from "@/meta-ads/constants/metaCapiStandardEvents";

export type MetaCapiEventNameSaveError = "custom_required" | "custom_too_long";

export function isMetaCapiStandardEvent(name: string): name is MetaCapiStandardEvent {
  return (META_CAPI_STANDARD_EVENTS as readonly string[]).includes(name);
}

export function sanitizeMetaCapiCustomEventName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function resolveMetaCapiEventNameForEdit(saved: string | null | undefined): {
  selectValue: string;
  customValue: string;
  isCustom: boolean;
} {
  const trimmed = sanitizeMetaCapiCustomEventName(String(saved ?? ""));
  if (trimmed && isMetaCapiStandardEvent(trimmed)) {
    return { selectValue: trimmed, customValue: "", isCustom: false };
  }
  if (trimmed) {
    return {
      selectValue: META_CAPI_CUSTOM_EVENT_VALUE,
      customValue: trimmed,
      isCustom: true,
    };
  }
  return {
    selectValue: META_CAPI_DEFAULT_EVENT_NAME,
    customValue: "",
    isCustom: false,
  };
}

export function resolveMetaCapiEventNameForSave(
  selectValue: string,
  customValue: string,
): { ok: true; eventName: string } | { ok: false; error: MetaCapiEventNameSaveError } {
  if (selectValue !== META_CAPI_CUSTOM_EVENT_VALUE) {
    if (isMetaCapiStandardEvent(selectValue)) {
      return { ok: true, eventName: selectValue };
    }
    return { ok: true, eventName: META_CAPI_DEFAULT_EVENT_NAME };
  }

  const sanitized = sanitizeMetaCapiCustomEventName(customValue);
  if (!sanitized) {
    return { ok: false, error: "custom_required" };
  }
  if (sanitized.length > META_CAPI_CUSTOM_EVENT_MAX_LENGTH) {
    return { ok: false, error: "custom_too_long" };
  }
  return { ok: true, eventName: sanitized };
}
