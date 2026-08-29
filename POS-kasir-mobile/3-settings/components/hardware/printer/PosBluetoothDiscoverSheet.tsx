import { Printer } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import type { PosBluetoothDevice } from "../../../lib/printer/posPrinterTypes";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>{t(POS_SETTINGS_I18N.printerBluetoothTitle, "Bluetooth")}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          {!available ? (
            <p className="text-sm text-slate-500">
              {t(
                POS_SETTINGS_I18N.printerBluetoothUnavailable,
                "Bluetooth printers are only available in the Synckerja Android app.",
              )}
            </p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
                <span className="text-sm font-medium text-slate-900">
                  {adapterOn
                    ? t(POS_SETTINGS_I18N.printerBluetoothOn, "On")
                    : t(POS_SETTINGS_I18N.printerBluetoothOff, "Off")}
                </span>
                <Switch checked={adapterOn} disabled aria-readonly />
              </div>

              {scanning ? (
                <p className="mb-2 text-xs text-slate-400">
                  {t(POS_SETTINGS_I18N.printerBluetoothScanning, "Scanning for devices…")}
                </p>
              ) : null}
              {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200 bg-white">
                {devices.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    {t(
                      POS_SETTINGS_I18N.printerBluetoothEmpty,
                      "No printers found. Make sure the printer is on and paired in device Bluetooth settings.",
                    )}
                  </p>
                ) : (
                  <ul>
                    {devices.map((d) => {
                      const selected = selectedAddress === d.address;
                      return (
                        <li key={d.address}>
                          <button
                            type="button"
                            onClick={() => onSelect(d)}
                            className={cn(
                              "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-b-0",
                              selected ? "bg-primary/5" : "hover:bg-slate-50",
                            )}
                          >
                            <Printer className="h-5 w-5 flex-shrink-0 text-slate-500" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {d.name}
                              </p>
                              <p className="truncate text-xs text-slate-400">{d.address}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 border-t px-4 py-3">
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
      </SheetContent>
    </Sheet>
  );
}
