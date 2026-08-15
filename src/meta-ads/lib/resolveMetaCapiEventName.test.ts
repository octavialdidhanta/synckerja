import { describe, expect, it } from "vitest";
import {
  META_CAPI_CUSTOM_EVENT_VALUE,
  META_CAPI_DEFAULT_EVENT_NAME,
} from "@/meta-ads/constants/metaCapiStandardEvents";
import {
  resolveMetaCapiEventNameForEdit,
  resolveMetaCapiEventNameForSave,
  sanitizeMetaCapiCustomEventName,
} from "@/meta-ads/lib/resolveMetaCapiEventName";

describe("resolveMetaCapiEventNameForEdit", () => {
  it("maps standard event to select value", () => {
    expect(resolveMetaCapiEventNameForEdit("Purchase")).toEqual({
      selectValue: "Purchase",
      customValue: "",
      isCustom: false,
    });
  });

  it("maps legacy custom event to custom mode", () => {
    expect(resolveMetaCapiEventNameForEdit("MyCustomEvent")).toEqual({
      selectValue: META_CAPI_CUSTOM_EVENT_VALUE,
      customValue: "MyCustomEvent",
      isCustom: true,
    });
  });

  it("defaults empty to Purchase", () => {
    expect(resolveMetaCapiEventNameForEdit("")).toEqual({
      selectValue: META_CAPI_DEFAULT_EVENT_NAME,
      customValue: "",
      isCustom: false,
    });
  });
});

describe("resolveMetaCapiEventNameForSave", () => {
  it("returns standard event from select", () => {
    expect(resolveMetaCapiEventNameForSave("Lead", "")).toEqual({
      ok: true,
      eventName: "Lead",
    });
  });

  it("returns custom event when custom mode selected", () => {
    expect(resolveMetaCapiEventNameForSave(META_CAPI_CUSTOM_EVENT_VALUE, "MyEvent")).toEqual({
      ok: true,
      eventName: "MyEvent",
    });
  });

  it("rejects empty custom", () => {
    expect(resolveMetaCapiEventNameForSave(META_CAPI_CUSTOM_EVENT_VALUE, "   ")).toEqual({
      ok: false,
      error: "custom_required",
    });
  });

  it("rejects custom that is too long", () => {
    expect(
      resolveMetaCapiEventNameForSave(META_CAPI_CUSTOM_EVENT_VALUE, "x".repeat(65)),
    ).toEqual({
      ok: false,
      error: "custom_too_long",
    });
  });
});

describe("sanitizeMetaCapiCustomEventName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeMetaCapiCustomEventName("  My  Event  ")).toBe("My Event");
  });
});
