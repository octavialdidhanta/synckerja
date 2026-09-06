import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";
import type { PosDeviceSettings } from "../../lib/posSettingsStorage";
import { PosTaxGratuityMethodSheet } from "./PosTaxGratuityMethodSheet";

type Props = {
  deviceSettings: PosDeviceSettings;
  onDeviceSettingsChange: (next: PosDeviceSettings) => void;
  onNavigateSection: (id: "tax" | "surcharge") => void;
};

/**
 * Pengaturan Pembayaran — tax/gratuity method entry + employee monitor toggle.
 */
export function PosPaymentSettingsPanel({
  deviceSettings,
  onDeviceSettingsChange,
  onNavigateSection,
}: Props) {
  const { t } = useAppTranslation();
  const checkout = useCatalogCheckoutSettings();
  const outletId = readPosSelectedOutletId();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isInclude = checkout.settings?.application_method === "include";
  const methodSubtitle = isInclude
    ? t(
        POS_SETTINGS_I18N.paymentSettingsPricesInclude,
        "Product prices already include Tax and Additional Fees",
      )
    : t(
        POS_SETTINGS_I18N.paymentSettingsPricesExclude,
        "Product prices do not include Tax and Additional Fees",
      );

  if (checkout.isLoading) {
    return (
      <div className={cn(POS_PANEL.body, "space-y-3")} aria-busy aria-label="Loading">
        <div className={cn(POS_PANEL.card, "h-16 animate-pulse bg-slate-100")} />
        <div className={cn(POS_PANEL.card, "h-14 animate-pulse bg-slate-100")} />
      </div>
    );
  }

  return (
    <>
      <div className={POS_PANEL.body}>
        <div className={POS_PANEL.card}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              POS_PANEL.row,
              "items-start text-left transition-colors hover:bg-slate-50",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">
                {t(
                  POS_SETTINGS_I18N.paymentSettingsTaxGratuityRow,
                  "Tax and Additional Fee Settings",
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {methodSubtitle}
              </p>
            </div>
            <ChevronRight
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
              aria-hidden
            />
          </button>
        </div>

        <div className={cn(POS_PANEL.card, "mt-3")}>
          <div className={POS_PANEL.row}>
            <span className="text-sm font-medium text-slate-900">
              {t(POS_SETTINGS_I18N.paymentSettingsEmployeeMonitor, "Employee Monitor")}
            </span>
            <Switch
              checked={deviceSettings.employeeMonitorEnabled}
              disabled={!outletId}
              onCheckedChange={(checked) =>
                onDeviceSettingsChange({
                  ...deviceSettings,
                  employeeMonitorEnabled: checked,
                })
              }
            />
          </div>
        </div>
      </div>

      <PosTaxGratuityMethodSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onNavigateSection={onNavigateSection}
      />
    </>
  );
}
