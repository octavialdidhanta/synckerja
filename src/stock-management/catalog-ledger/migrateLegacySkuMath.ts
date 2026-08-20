export type LegacySkuMigrationDecision = "migrate" | "skip_variant" | "skip_done" | "skip_unchanged";

export function legacySkuMigrationDecision(args: {
  hasVariants: boolean;
  alreadyMigrated: boolean;
  skuQty: number;
  catalogQty: number;
}): LegacySkuMigrationDecision {
  if (args.hasVariants) return "skip_variant";
  if (args.alreadyMigrated) return "skip_done";
  if (args.skuQty === args.catalogQty) return "skip_unchanged";
  return "migrate";
}

export type LegacySkuMigrationResult = {
  migrated: number;
  skipped: number;
};

export function aggregateLegacySkuMigrationResults(
  decisions: LegacySkuMigrationDecision[],
): LegacySkuMigrationResult {
  let migrated = 0;
  let skipped = 0;
  for (const decision of decisions) {
    if (decision === "migrate") migrated += 1;
    else skipped += 1;
  }
  return { migrated, skipped };
}
