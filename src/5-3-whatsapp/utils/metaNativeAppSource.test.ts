import { describe, expect, it } from "vitest";
import { metaNativeAppSource } from "./metaNativeAppSource";

describe("metaNativeAppSource", () => {
  it("marks outbound native-app echoes as business_app", () => {
    expect(metaNativeAppSource({ direction: "outbound", raw_metadata: { synckerja_source: "native_app" } })).toBe("business_app");
  });
  it("leaves Synckerja-sent replies unmarked", () => {
    expect(metaNativeAppSource({ direction: "outbound", raw_metadata: { mid: "m1" } })).toBeNull();
    expect(metaNativeAppSource({ direction: "outbound", raw_metadata: null })).toBeNull();
  });
  it("never marks inbound messages", () => {
    expect(metaNativeAppSource({ direction: "inbound", raw_metadata: { synckerja_source: "native_app" } })).toBeNull();
  });
});
