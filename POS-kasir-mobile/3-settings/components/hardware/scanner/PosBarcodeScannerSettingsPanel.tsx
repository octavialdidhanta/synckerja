import { useState } from "react";
import { Switch } from "@/shared/components/ui/switch";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import { usePosBarcodeScannerSettings } from "../../../lib/scanner/usePosBarcodeScannerSettings";
import { usePosBarcodeWedgeScan } from "@/pos-mobile/2-cashier/hooks/usePosBarcodeWedgeScan";

/**
 * Hardware → Barcode Scanner settings (HID wedge + camera prefs).
 */
export function PosBarcodeScannerSettingsPanel() {
  const { t } = useAppTranslation();
  const outletId = readPosSelectedOutletId();
  const { settings, persist } = usePosBarcodeScannerSettings(outletId);
  const [testListening, setTestListening] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  usePosBarcodeWedgeScan({
    enabled: testListening,
    onScan: (raw) => {
      setLastScan(raw);
      setTestListening(false);
    },
  });

  const row = (
    label: string,
    hint: string | null,
    checked: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="px-4 py-2 pb-8">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        {t(
          POS_SETTINGS_I18N.barcodeScannerHint,
          "Pair a Bluetooth scanner in system settings as a keyboard (HID). Camera scan is available on the cashier screen.",
        )}
      </p>

      <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
        {row(
          t(POS_SETTINGS_I18N.barcodeScannerWedge, "Keyboard wedge (HID)"),
          t(
            POS_SETTINGS_I18N.barcodeScannerWedgeHint,
            "Accept scans from a Bluetooth / USB scanner that types like a keyboard.",
          ),
          settings.wedgeEnabled,
          (wedgeEnabled) => persist({ ...settings, wedgeEnabled }),
        )}
        {row(
          t(POS_SETTINGS_I18N.barcodeScannerCamera, "Camera scan"),
          t(
            POS_SETTINGS_I18N.barcodeScannerCameraHint,
            "Show the camera scanner button on the cashier screen.",
          ),
          settings.cameraEnabled,
          (cameraEnabled) => persist({ ...settings, cameraEnabled }),
        )}
        {row(
          t(POS_SETTINGS_I18N.barcodeScannerGuestQr, "Guest order QR (SYNK)"),
          null,
          settings.guestQrScanEnabled,
          (guestQrScanEnabled) => persist({ ...settings, guestQrScanEnabled }),
        )}
        {row(
          t(POS_SETTINGS_I18N.barcodeScannerProduct, "Product SKU"),
          t(
            POS_SETTINGS_I18N.barcodeScannerProductHint,
            "Add a product to the bill when the scanned code matches the catalog SKU.",
          ),
          settings.productScanEnabled,
          (productScanEnabled) => persist({ ...settings, productScanEnabled }),
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">
          {t(POS_SETTINGS_I18N.barcodeScannerTestTitle, "Test wedge")}
        </h3>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full border-primary text-primary"
          disabled={!settings.wedgeEnabled}
          onClick={() => {
            setLastScan(null);
            setTestListening(true);
          }}
        >
          {testListening
            ? t(POS_SETTINGS_I18N.barcodeScannerTestListening, "Listening… scan now")
            : t(POS_SETTINGS_I18N.barcodeScannerTestStart, "Start test scan")}
        </Button>
        {lastScan ? (
          <p className="mt-2 break-all rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {t(POS_SETTINGS_I18N.barcodeScannerLastScan, "Last scan")}: {lastScan}
          </p>
        ) : null}
      </section>
    </div>
  );
}
