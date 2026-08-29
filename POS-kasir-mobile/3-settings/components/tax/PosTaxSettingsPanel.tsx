import { useMemo, useState } from "react";
import { filterTaxesForOutlet } from "@/8-2-1-default-prices/checkout";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { useCatalogTaxes } from "@/8-2-1-default-prices/taxes/hooks/useCatalogTaxes";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";
import { PosRatePercentRow } from "../shared/PosRatePercentRow";

/**
 * Tax settings panel — org `tax_enabled` toggle + outlet-scoped tax rates.
 * Same catalog data as `/operations/settings/checkout` and receipt preview.
 */
export function PosTaxSettingsPanel() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const outletId = readPosSelectedOutletId();
  const checkout = useCatalogCheckoutSettings();
  const taxes = useCatalogTaxes();

  const taxEnabled = Boolean(checkout.settings?.tax_enabled);
  const [pending, setPending] = useState(false);

  const outletTaxes = useMemo(
    () => filterTaxesForOutlet(taxes.rows, outletId),
    [taxes.rows, outletId],
  );

  const loading = checkout.isLoading || taxes.isLoading;

  const onToggle = async (checked: boolean) => {
    if (!checkout.settings || pending || checkout.isSaving) return;
    setPending(true);
    try {
      await checkout.save({
        tax_enabled: checked,
        gratuity_enabled: checkout.settings.gratuity_enabled,
        application_method: checkout.settings.application_method,
      });
    } catch {
      toast({
        title: t(POS_SETTINGS_I18N.taxSaveError, "Failed to update tax setting"),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-4" aria-busy aria-label="Loading">
        <div className="h-14 animate-pulse rounded-md border border-slate-100 bg-slate-100" />
        <div className="h-10 animate-pulse rounded bg-slate-100" />
        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-8">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3">
        <span className="text-sm font-medium text-slate-900">
          {t(POS_SETTINGS_I18N.taxToggleLabel, "Tax")}
        </span>
        <Switch
          checked={taxEnabled}
          disabled={pending || checkout.isSaving || !checkout.settings}
          onCheckedChange={(checked) => void onToggle(checked)}
        />
      </div>

      {outletTaxes.length === 0 ? (
        <p className="px-1 py-2 text-sm text-slate-400">
          {t(POS_SETTINGS_I18N.taxEmpty, "No taxes for this outlet yet")}
        </p>
      ) : (
        <div className="divide-y divide-transparent">
          {outletTaxes.map((rate) => (
            <PosRatePercentRow
              key={rate.id}
              name={rate.name}
              amountPercent={rate.amount_percent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
