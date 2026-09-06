import { ArrowLeft, Check, Printer } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import type { PosBluetoothDevice } from "../../../lib/printer/posPrinterTypes";
import { PosPrinterPageChrome } from "./PosPrinterPageChrome";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available: boolean;
  adapterOn: boolean;
  scanning: boolean;
  devices: PosBluetoothDevice[];
  error: string | null;
  selectedAddress: string | null;
  onSelect: (device: PosBluetoothDevice) => void;
  onDone: () => void;
  onDetails?: () => void;
};

export function PosBluetoothDiscoverSheet({
  open,
  onOpenChange,
  available,
  adapterOn,
  scanning,
  devices,
  error,
  selectedAddress,
  onSelect,
  onDone,
  onDetails,
}: Props) {
  const { t } = useAppTranslation();
  const title = t(POS_SETTINGS_I18N.printerBluetoothTitle, "Bluetooth");

  return (
    <PosPrinterPageChrome open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          <div className={cn(POS_PANEL.header, "flex-row space-y-0 border-b-0 text-left")}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={POS_PANEL.headerBack}
              aria-label={t(POS_SETTINGS_I18N.back, "Back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className={cn(POS_PANEL.headerTitle, "leading-none")}>{title}</h1>
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={POS_PANEL.body}>
            {!available ? (
              <p className="px-0.5 text-sm text-slate-500">
                {t(
                  POS_SETTINGS_I18N.printerBluetoothUnavailable,
                  "Bluetooth printers are only available in the Synckerja Android app.",
                )}
              </p>
            ) : (
              <>
                <div className={POS_PANEL.card}>
                  <div className={POS_PANEL.row}>
                    <span className={POS_PANEL.rowLabel}>
                      {adapterOn
                        ? t(POS_SETTINGS_I18N.printerBluetoothOn, "On")
                        : t(POS_SETTINGS_I18N.printerBluetoothOff, "Off")}
                    </span>
                    <Switch checked={adapterOn} disabled aria-readonly />
                  </div>
                </div>

                {scanning ? (
                  <p className="mt-3 px-0.5 text-xs text-slate-500">
                    {t(
                      POS_SETTINGS_I18N.printerBluetoothScanning,
                      "Scanning for devices…",
                    )}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-2 px-0.5 text-xs text-red-600">{error}</p>
                ) : null}

                <div className={cn(POS_PANEL.card, scanning || error ? "mt-2" : "mt-3")}>
                  {devices.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-500">
                      {t(
                        POS_SETTINGS_I18N.printerBluetoothEmpty,
                        "No printers found. Make sure the printer is on and paired in device Bluetooth settings.",
                      )}
                    </p>
                  ) : (
                    devices.map((d) => {
                      const selected = selectedAddress === d.address;
                      return (
                        <button
                          key={d.address}
                          type="button"
                          onClick={() => onSelect(d)}
                          className={cn(
                            POS_PANEL.row,
                            "text-left transition-colors hover:bg-slate-50",
                          )}
                        >
                          <Printer className="h-5 w-5 flex-shrink-0 text-slate-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {d.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">{d.address}</p>
                          </div>
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                            {selected ? (
                              <Check className="h-5 w-5 text-primary" aria-hidden />
                            ) : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-2 pt-2.5 pb-2 sm:px-2.5">
          <Button type="button" variant="ghost" className="flex-1" onClick={onDetails}>
            {t(POS_SETTINGS_I18N.printerBluetoothDetails, "Details")}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-primary text-primary-foreground"
            onClick={onDone}
            disabled={available && !selectedAddress}
          >
            {t(POS_SETTINGS_I18N.printerBluetoothDone, "Done")}
          </Button>
        </div>
      </div>
    </PosPrinterPageChrome>
  );
}
