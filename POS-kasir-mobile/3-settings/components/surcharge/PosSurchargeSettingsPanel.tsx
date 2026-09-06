import { useMemo, useState } from "react";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { useCatalogGratuities } from "@/8-2-1-default-prices/gratuity/hooks/useCatalogGratuities";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";
import { PosRatePercentRow } from "../shared/PosRatePercentRow";

/**
 * Biaya Tambahan panel — org `gratuity_enabled` + outlet-scoped catalog gratuities.
 * Same data as `/operations/library/gratuity` and checkout/receipt pricing.
 */
export function PosSurchargeSettingsPanel() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const outletId = readPosSelectedOutletId();
  const checkout = useCatalogCheckoutSettings();
  const gratuities = useCatalogGratuities();

  const gratuityEnabled = Boolean(checkout.settings?.gratuity_enabled);
  const [pending, setPending] = useState(false);

  const outletRates = useMemo(
    () =>
      (gratuities.rows ?? []).filter(
        (g) => Boolean(outletId) && g.outlet_ids.includes(outletId!),
      ),
    [gratuities.rows, outletId],
  );

  const loading = checkout.isLoading || gratuities.isLoading;

  const onToggle = async (checked: boolean) => {
    if (!checkout.settings || pending || checkout.isSaving) return;
    setPending(true);
    try {
      await checkout.save({
        tax_enabled: checkout.settings.tax_enabled,
        gratuity_enabled: checked,
        application_method: checkout.settings.application_method,
      });
    } catch {
      toast({
        title: t(POS_SETTINGS_I18N.surchargeSaveError, "Failed to update additional fees"),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className={cn(POS_PANEL.body, "space-y-3")} aria-busy aria-label="Loading">
        <div className={cn(POS_PANEL.card, "h-14 animate-pulse bg-slate-100")} />
        <div className={cn(POS_PANEL.card, "h-10 animate-pulse bg-slate-100")} />
        <div className={cn(POS_PANEL.card, "h-10 animate-pulse bg-slate-100")} />
      </div>
    );
  }

  return (
    <div className={POS_PANEL.body}>
      <div className={POS_PANEL.card}>
        <div className={POS_PANEL.row}>
          <span className="min-w-0 flex-1 pr-2 text-sm font-medium text-slate-900">
            {t(
              POS_SETTINGS_I18N.surchargeToggleLabel,
              "Collected additional fees",
            )}
          </span>
          <Switch
            checked={gratuityEnabled}
            disabled={pending || checkout.isSaving || !checkout.settings}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>
      </div>

      {outletRates.length === 0 ? (
        <p className="px-0.5 py-2 text-sm text-slate-400">
          {t(
            POS_SETTINGS_I18N.surchargeEmpty,
            "No additional fees for this outlet yet",
          )}
        </p>
      ) : (
        <div className={cn(POS_PANEL.card, "mt-3")}>
          {outletRates.map((rate) => (
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
