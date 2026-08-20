import { describe, expect, it } from "vitest";
import { aggregateLegacySkuMigrationResults, legacySkuMigrationDecision } from "./migrateLegacySkuMath";

describe("legacySkuMigrationDecision", () => {
  it("skips variant products", () => {
    expect(
      legacySkuMigrationDecision({
        hasVariants: true,
        alreadyMigrated: false,
        skuQty: 10,
        catalogQty: 0,
      }),
    ).toBe("skip_variant");
  });

  it("skips when migration already recorded", () => {
    expect(
      legacySkuMigrationDecision({
        hasVariants: false,
        alreadyMigrated: true,
        skuQty: 10,
        catalogQty: 0,
      }),
    ).toBe("skip_done");
  });

  it("skips when qty already matches", () => {
    expect(
      legacySkuMigrationDecision({
        hasVariants: false,
        alreadyMigrated: false,
        skuQty: 5,
        catalogQty: 5,
      }),
    ).toBe("skip_unchanged");
  });

  it("migrates when sku qty differs from catalog", () => {
    expect(
      legacySkuMigrationDecision({
        hasVariants: false,
        alreadyMigrated: false,
        skuQty: 12,
        catalogQty: 3,
      }),
    ).toBe("migrate");
  });
});

describe("aggregateLegacySkuMigrationResults", () => {
  it("counts migrated vs skipped", () => {
    expect(
      aggregateLegacySkuMigrationResults([
        "migrate",
        "skip_variant",
        "skip_done",
        "migrate",
        "skip_unchanged",
      ]),
    ).toEqual({ migrated: 2, skipped: 3 });
  });
});
