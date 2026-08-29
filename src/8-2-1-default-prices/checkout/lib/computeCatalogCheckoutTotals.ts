import type { CatalogCheckoutApplicationMethod, CatalogCheckoutSettings } from "../types";

export type CatalogRateLine = {
  id: string;
  name: string;
  amount_percent: number;
};

export type CatalogCheckoutTotalsLine = {
  name: string;
  amount: number;
  amount_percent: number;
};

export type CatalogCheckoutTotals = {
  subtotal: number;
  /** Catalog-only basis used to compute tax (subtotal + gratuity on catalog lines). Untouched by custom amounts. */
  taxBase: number;
  taxLines: CatalogCheckoutTotalsLine[];
  gratuityLines: CatalogCheckoutTotalsLine[];
  taxTotal: number;
  gratuityTotal: number;
  grandTotal: number;
  applicationMethod: CatalogCheckoutApplicationMethod;
};

export type ComputeCatalogCheckoutTotalsInput = {
  subtotal: number;
  settings: Pick<CatalogCheckoutSettings, "tax_enabled" | "gratuity_enabled" | "application_method"> | null;
  taxes: CatalogRateLine[];
  gratuities: CatalogRateLine[];
};

function roundRp(value: number): number {
  return Math.round(value);
}

function activeRates(rates: CatalogRateLine[]): CatalogRateLine[] {
  return rates.filter((rate) => rate.amount_percent > 0);
}

function computeAdditiveLines(base: number, rates: CatalogRateLine[]): CatalogCheckoutTotalsLine[] {
  return activeRates(rates).map((rate) => ({
    name: rate.name,
    amount: roundRp((base * rate.amount_percent) / 100),
    amount_percent: rate.amount_percent,
  }));
}

function sumLineAmounts(lines: CatalogCheckoutTotalsLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Back-calculate included components from a tax-inclusive total. */
function computeIncludedLines(
  inclusiveTotal: number,
  gratuityRates: CatalogRateLine[],
  taxRates: CatalogRateLine[],
): {
  gratuityLines: CatalogCheckoutTotalsLine[];
  taxLines: CatalogCheckoutTotalsLine[];
  taxBase: number;
} {
  const gratuityPercent = activeRates(gratuityRates).reduce((sum, r) => sum + r.amount_percent, 0);
  const taxPercent = activeRates(taxRates).reduce((sum, r) => sum + r.amount_percent, 0);
  const combinedPercent = gratuityPercent + taxPercent;

  if (combinedPercent <= 0 || inclusiveTotal <= 0) {
    return { gratuityLines: [], taxLines: [], taxBase: 0 };
  }

  const preTaxBase = roundRp(inclusiveTotal / (1 + combinedPercent / 100));
  const gratuityLines = computeAdditiveLines(preTaxBase, gratuityRates);
  const gratuityTotal = sumLineAmounts(gratuityLines);
  const taxBase = preTaxBase + gratuityTotal;
  const taxLines = computeAdditiveLines(taxBase, taxRates);

  return { gratuityLines, taxLines, taxBase };
}

export function computeCatalogCheckoutTotals(input: ComputeCatalogCheckoutTotalsInput): CatalogCheckoutTotals {
  const subtotal = Math.max(0, roundRp(input.subtotal));
  const settings = input.settings;
  const applicationMethod: CatalogCheckoutApplicationMethod =
    settings?.application_method === "include" ? "include" : "add";

  const gratuityEnabled = Boolean(settings?.gratuity_enabled);
  const taxEnabled = Boolean(settings?.tax_enabled);
  const gratuityRates = gratuityEnabled ? input.gratuities : [];
  const taxRates = taxEnabled ? input.taxes : [];

  if (applicationMethod === "include") {
    const { gratuityLines, taxLines, taxBase } = computeIncludedLines(subtotal, gratuityRates, taxRates);
    const gratuityTotal = sumLineAmounts(gratuityLines);
    const taxTotal = sumLineAmounts(taxLines);
    return {
      subtotal,
      taxBase,
      taxLines,
      gratuityLines,
      taxTotal,
      gratuityTotal,
      grandTotal: subtotal,
      applicationMethod,
    };
  }

  const gratuityLines = computeAdditiveLines(subtotal, gratuityRates);
  const gratuityTotal = sumLineAmounts(gratuityLines);
  const taxBase = subtotal + gratuityTotal;
  const taxLines = computeAdditiveLines(taxBase, taxRates);
  const taxTotal = sumLineAmounts(taxLines);
  const grandTotal = subtotal + gratuityTotal + taxTotal;

  return {
    subtotal,
    taxBase,
    taxLines,
    gratuityLines,
    taxTotal,
    gratuityTotal,
    grandTotal,
    applicationMethod,
  };
}

export type CatalogRateWithOutlets = CatalogRateLine & { outlet_ids?: string[] };

export function filterTaxesForOutlet(taxes: CatalogRateWithOutlets[], outletId: string | null): CatalogRateLine[] {
  if (!outletId) return [];
  return taxes.filter(
    (tax) => Array.isArray(tax.outlet_ids) && tax.outlet_ids.includes(outletId),
  );
}

export function filterGratuitiesForOutletAndSalesType(
  gratuities: CatalogRateWithOutlets[],
  outletId: string | null,
  salesTypeGratuityIds: string[],
): CatalogRateLine[] {
  if (!outletId || salesTypeGratuityIds.length === 0) return [];
  const allowed = new Set(salesTypeGratuityIds);
  return gratuities.filter(
    (g) => Array.isArray(g.outlet_ids) && g.outlet_ids.includes(outletId) && allowed.has(g.id),
  );
}
