import { useCallback, useMemo } from "react";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import {
  computeCatalogCheckoutTotals,
  filterGratuitiesForOutletAndSalesType,
  filterTaxesForOutlet,
  type CatalogCheckoutTotals,
} from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { useCatalogGratuities } from "@/8-2-1-default-prices/gratuity/hooks/useCatalogGratuities";
import { useCatalogSalesTypes } from "@/8-2-1-default-prices/sales-types/hooks/useCatalogSalesTypes";
import { useCatalogTaxes } from "@/8-2-1-default-prices/taxes/hooks/useCatalogTaxes";
import type { CustomerVisitCartLine } from "../lib/customerVisitCheckout.types";
import { sumCustomerVisitCart } from "../lib/sumCustomerVisitCart";

export function useStoreCheckoutPricing(outletId: string | null, salesTypeId: string | null) {
  const { settings, isLoading: settingsLoading } = useCatalogCheckoutSettings();
  const { rows: taxes, isLoading: taxesLoading } = useCatalogTaxes();
  const { rows: gratuities, isLoading: gratuitiesLoading } = useCatalogGratuities();
  const { rows: salesTypes, isLoading: salesTypesLoading } = useCatalogSalesTypes();

  const salesType = useMemo(
    () => salesTypes.find((row) => row.id === salesTypeId) ?? null,
    [salesTypeId, salesTypes],
  );

  const outletTaxes = useMemo(
    () => filterTaxesForOutlet(taxes.filter((t) => t.is_active), outletId),
    [taxes, outletId],
  );

  const outletGratuities = useMemo(
    () =>
      filterGratuitiesForOutletAndSalesType(
        gratuities.filter((g) => g.is_active),
        outletId,
        salesType?.gratuity_ids ?? [],
      ),
    [gratuities, outletId, salesType],
  );

  const outletSalesTypes = useMemo(
    () =>
      salesTypes
        .filter((row) => row.is_active && outletId && row.outlet_ids.includes(outletId))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [salesTypes, outletId],
  );

  const isLoading = settingsLoading || taxesLoading || gratuitiesLoading || salesTypesLoading;

  const compute = useCallback(
    (lines: CustomerVisitCartLine[]): CatalogCheckoutTotals => {
      const cartTotals = sumCustomerVisitCart(lines);
      return computeCatalogCheckoutTotals({
        subtotal: cartTotals.total,
        settings,
        taxes: outletTaxes,
        gratuities: outletGratuities,
      });
    },
    [settings, outletTaxes, outletGratuities],
  );

  return {
    settings,
    outletTaxes,
    outletGratuities,
    outletSalesTypes,
    isLoading,
    compute,
  };
}
