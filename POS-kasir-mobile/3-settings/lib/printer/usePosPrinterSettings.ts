import { useCallback, useEffect, useState } from "react";
import {
  readPosPrinterSettings,
  writePosPrinterSettings,
} from "./posPrinterStorage";
import type { PosPrinterOutletSettings, PosSavedPrinter } from "./posPrinterTypes";

export function usePosPrinterSettings(outletId: string | null) {
  const [settings, setSettings] = useState<PosPrinterOutletSettings>(() =>
    outletId ? readPosPrinterSettings(outletId) : readPosPrinterSettings("_"),
  );

  useEffect(() => {
    if (!outletId) return;
    setSettings(readPosPrinterSettings(outletId));
  }, [outletId]);

  const persist = useCallback(
    (next: PosPrinterOutletSettings) => {
      setSettings(next);
      if (outletId) writePosPrinterSettings(outletId, next);
    },
    [outletId],
  );

  const upsertPrinter = useCallback(
    (printer: PosSavedPrinter) => {
      persist({
        ...settings,
        printers: (() => {
          const idx = settings.printers.findIndex(
            (p) => p.id === printer.id || p.address === printer.address,
          );
          if (idx < 0) return [...settings.printers, printer];
          const next = [...settings.printers];
          next[idx] = { ...printer, id: next[idx].id };
          return next;
        })(),
      });
    },
    [persist, settings],
  );

  const removePrinter = useCallback(
    (id: string) => {
      persist({
        ...settings,
        printers: settings.printers.filter((p) => p.id !== id),
      });
    },
    [persist, settings],
  );

  return { settings, persist, upsertPrinter, removePrinter };
}
