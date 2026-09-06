import { describe, expect, it } from "vitest";
import { shouldShowPosPaySuccessSmsRow } from "./shouldShowPosPaySuccessSmsRow";

describe("shouldShowPosPaySuccessSmsRow", () => {
  it("hides when SMS share is off", () => {
    expect(
      shouldShowPosPaySuccessSmsRow({
        shareViaSms: false,
        customerPhone: "6281281714855",
      }),
    ).toBe(false);
  });

  it("hides when SMS is on but no phone", () => {
    expect(
      shouldShowPosPaySuccessSmsRow({
        shareViaSms: true,
        customerPhone: null,
        phoneLocal: "",
      }),
    ).toBe(false);
  });

  it("shows when SMS is on and customer phone is present", () => {
    expect(
      shouldShowPosPaySuccessSmsRow({
        shareViaSms: true,
        customerPhone: "6281281714855",
      }),
    ).toBe(true);
  });

  it("shows when SMS is on and field has local digits", () => {
    expect(
      shouldShowPosPaySuccessSmsRow({
        shareViaSms: true,
        phoneLocal: "81281714855",
      }),
    ).toBe(true);
  });
});
