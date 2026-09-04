export type PosBarcodeScannerSettings = {
  wedgeEnabled: boolean;
  cameraEnabled: boolean;
  productScanEnabled: boolean;
  guestQrScanEnabled: boolean;
};

export const DEFAULT_POS_BARCODE_SCANNER_SETTINGS: PosBarcodeScannerSettings = {
  wedgeEnabled: true,
  cameraEnabled: true,
  productScanEnabled: true,
  guestQrScanEnabled: true,
};

const STORAGE_PREFIX = "synckerja_pos_scanner_";

function storageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readPosBarcodeScannerSettings(
  outletId: string | null | undefined,
): PosBarcodeScannerSettings {
  const id = outletId?.trim();
  if (!id) return { ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS };
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return { ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PosBarcodeScannerSettings>;
    return {
      wedgeEnabled: asBool(parsed.wedgeEnabled, DEFAULT_POS_BARCODE_SCANNER_SETTINGS.wedgeEnabled),
      cameraEnabled: asBool(parsed.cameraEnabled, DEFAULT_POS_BARCODE_SCANNER_SETTINGS.cameraEnabled),
      productScanEnabled: asBool(
        parsed.productScanEnabled,
        DEFAULT_POS_BARCODE_SCANNER_SETTINGS.productScanEnabled,
      ),
      guestQrScanEnabled: asBool(
        parsed.guestQrScanEnabled,
        DEFAULT_POS_BARCODE_SCANNER_SETTINGS.guestQrScanEnabled,
      ),
    };
  } catch {
    return { ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS };
  }
}

export function writePosBarcodeScannerSettings(
  outletId: string,
  settings: PosBarcodeScannerSettings,
): void {
  try {
    localStorage.setItem(storageKey(outletId), JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}
