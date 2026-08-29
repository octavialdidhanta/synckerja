import type { PosBluetoothDevice } from "@/pos-mobile/3-settings/lib/printer/posPrinterTypes";

export type PosPrinterBridge = {
  isAvailable(): Promise<boolean>;
  getAdapterEnabled(): Promise<boolean>;
  requestEnable(): Promise<boolean>;
  listBondedDevices(): Promise<PosBluetoothDevice[]>;
  startDiscovery(onDevice: (device: PosBluetoothDevice) => void): Promise<() => void>;
  stopDiscovery(): Promise<void>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  printRaw(bytes: Uint8Array): Promise<void>;
};

export class PosPrinterUnavailableError extends Error {
  constructor(message = "Bluetooth printer is only available on the Synckerja Android app.") {
    super(message);
    this.name = "PosPrinterUnavailableError";
  }
}
