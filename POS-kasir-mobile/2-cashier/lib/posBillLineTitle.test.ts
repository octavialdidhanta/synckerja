import { describe, expect, it } from "vitest";
import { posBillLineTitle } from "./posBillLineTitle";

describe("posBillLineTitle", () => {
  it("uses the product name only", () => {
    expect(
      posBillLineTitle({
        serviceName: "Ayam Balado",
      }),
    ).toBe("Ayam Balado");
  });

  it("falls back when the name is blank", () => {
    expect(posBillLineTitle({ serviceName: "  " })).toBe("—");
  });
});
