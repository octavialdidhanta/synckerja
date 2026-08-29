import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePosPrinterBridge } from "@/pos-mobile/shared/printing/bridges/CapacitorBluetoothPrinterBridge";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import type { PosBluetoothDevice } from "../posPrinterTypes";

export function usePosBluetoothScan() {
  const [available, setAvailable] = useState(false);
  const [adapterOn, setAdapterOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<PosBluetoothDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const refreshAvailability = useCallback(async () => {
    const bridge = resolvePosPrinterBridge();
    try {
      const ok = await bridge.isAvailable();
      setAvailable(ok);
      if (ok) {
        setAdapterOn(await bridge.getAdapterEnabled());
      } else {
        setAdapterOn(false);
      }
    } catch {
      setAvailable(false);
      setAdapterOn(false);
    }
  }, []);

  useEffect(() => {
    void refreshAvailability();
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [refreshAvailability]);

  const stopScan = useCallback(async () => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
    try {
      await resolvePosPrinterBridge().stopDiscovery();
    } catch {
      /* ignore */
    }
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    const bridge = resolvePosPrinterBridge();
    try {
      const ok = await bridge.isAvailable();
      setAvailable(ok);
      if (!ok) throw new PosPrinterUnavailableError();

      let enabled = await bridge.getAdapterEnabled();
      if (!enabled) {
        enabled = await bridge.requestEnable();
      }
      setAdapterOn(enabled);
      if (!enabled) {
        setError("Bluetooth is off");
        return;
      }

      await stopScan();
      setScanning(true);
      const seen = new Set<string>();
      const stop = await bridge.startDiscovery((device) => {
        if (seen.has(device.address)) return;
        seen.add(device.address);
        setDevices((prev) => [...prev, device]);
      });
      stopRef.current = () => {
        void stop();
      };

      // Also merge bonded list in case discovery is slow
      const bonded = await bridge.listBondedDevices();
      for (const d of bonded) {
        if (seen.has(d.address)) continue;
        seen.add(d.address);
        setDevices((prev) => [...prev, d]);
      }
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [stopScan]);

  return {
    available,
    adapterOn,
    scanning,
    devices,
    error,
    startScan,
    stopScan,
    refreshAvailability,
  };
}
