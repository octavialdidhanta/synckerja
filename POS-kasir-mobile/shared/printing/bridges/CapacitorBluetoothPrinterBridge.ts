import { Capacitor } from "@capacitor/core";
import { isPosNativeApp } from "@/shared/native/appSurface";
import { PosBluetoothPrinter } from "@/plugins/pos-bluetooth-printer";
import type { PosBluetoothDevice } from "@/pos-mobile/3-settings/lib/printer/posPrinterTypes";
import type { PosPrinterBridge } from "../PosPrinterBridge";
import { createUnavailablePrinterBridge } from "./UnavailablePrinterBridge";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function createCapacitorBluetoothPrinterBridge(): PosPrinterBridge {
  return {
    async isAvailable() {
      if (!isPosNativeApp()) return false;
      try {
        const { available } = await PosBluetoothPrinter.isAvailable();
        return Boolean(available);
      } catch {
        return false;
      }
    },

    async getAdapterEnabled() {
      try {
        if (typeof PosBluetoothPrinter.requestPermissions === "function") {
          await PosBluetoothPrinter.requestPermissions();
        }
      } catch {
        /* fall through — isEnabledSafe returns false without CONNECT */
      }
      try {
        const { enabled } = await PosBluetoothPrinter.getAdapterState();
        return Boolean(enabled);
      } catch {
        return false;
      }
    },

    async requestEnable() {
      try {
        const { enabled } = await PosBluetoothPrinter.requestEnable();
        return Boolean(enabled);
      } catch {
        return false;
      }
    },

    async listBondedDevices() {
      const { devices } = await PosBluetoothPrinter.listBondedDevices();
      return (devices ?? []).map(
        (d): PosBluetoothDevice => ({
          address: d.address,
          name: d.name || d.address,
          bonded: d.bonded ?? true,
        }),
      );
    },

    async startDiscovery(onDevice) {
      // Ask for Nearby Devices / location before any adapter reads that need CONNECT.
      try {
        if (typeof PosBluetoothPrinter.requestPermissions === "function") {
          await PosBluetoothPrinter.requestPermissions();
        }
      } catch {
        /* native startDiscovery will re-request / reject cleanly */
      }
      const handleFound = await PosBluetoothPrinter.addListener("deviceFound", (device) => {
        onDevice({
          address: device.address,
          name: device.name || device.address,
          bonded: device.bonded,
        });
      });
      try {
        await PosBluetoothPrinter.startDiscovery();
      } catch (err) {
        await handleFound.remove();
        throw err;
      }
      return () => {
        void handleFound.remove();
        void PosBluetoothPrinter.stopDiscovery();
      };
    },

    async stopDiscovery() {
      try {
        await PosBluetoothPrinter.stopDiscovery();
      } catch {
        /* ignore */
      }
    },

    async connect(address) {
      await PosBluetoothPrinter.connect({ address });
    },

    async disconnect() {
      await PosBluetoothPrinter.disconnect();
    },

    async printRaw(bytes) {
      await PosBluetoothPrinter.printRaw({ dataBase64: bytesToBase64(bytes) });
    },
  };
}

let cached: PosPrinterBridge | null = null;

/** Resolve the active printer bridge for this runtime (POS native Android only). */
export function resolvePosPrinterBridge(): PosPrinterBridge {
  if (cached) return cached;
  if (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android" &&
    isPosNativeApp()
  ) {
    cached = createCapacitorBluetoothPrinterBridge();
  } else {
    cached = createUnavailablePrinterBridge();
  }
  return cached;
}
