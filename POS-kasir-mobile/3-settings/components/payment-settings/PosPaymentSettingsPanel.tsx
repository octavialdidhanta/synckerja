import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
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
      <div className="space-y-4 px-4 py-4" aria-busy aria-label="Loading">
        <div className="h-16 animate-pulse rounded bg-slate-100" />
        <div className="h-14 animate-pulse rounded-md border border-slate-100 bg-slate-100" />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2 pb-8">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-start gap-3 border-b border-slate-100 py-4 text-left transition-colors hover:bg-slate-50"
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
          <ChevronRight className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden />
        </button>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3">
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

      <PosTaxGratuityMethodSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onNavigateSection={onNavigateSection}
      />
    </>
  );
}
