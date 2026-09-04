import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_POS_BARCODE_SCANNER_SETTINGS,
  readPosBarcodeScannerSettings,
  writePosBarcodeScannerSettings,
  type PosBarcodeScannerSettings,
} from "./posBarcodeScannerStorage";

export function usePosBarcodeScannerSettings(outletId: string | null) {
  const [settings, setSettings] = useState<PosBarcodeScannerSettings>(() =>
    outletId
      ? readPosBarcodeScannerSettings(outletId)
      : { ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS },
  );

  useEffect(() => {
    setSettings(
      outletId
        ? readPosBarcodeScannerSettings(outletId)
        : { ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS },
    );
  }, [outletId]);

  const persist = useCallback(
    (next: PosBarcodeScannerSettings) => {
      setSettings(next);
      if (outletId) writePosBarcodeScannerSettings(outletId, next);
    },
    [outletId],
  );

  return { settings, persist };
}
