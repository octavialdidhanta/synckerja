import { registerPlugin } from "@capacitor/core";

export type PosBluetoothPrinterDevice = {
  address: string;
  name: string;
  bonded?: boolean;
};

export type PosBluetoothPrinterPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  getAdapterState(): Promise<{ enabled: boolean }>;
  requestEnable(): Promise<{ enabled: boolean }>;
  listBondedDevices(): Promise<{ devices: PosBluetoothPrinterDevice[] }>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  connect(options: { address: string }): Promise<void>;
  disconnect(): Promise<void>;
  /** Base64-encoded ESC/POS bytes */
  printRaw(options: { dataBase64: string }): Promise<void>;
  /** Capacitor permission helpers (Android 12+ nearby devices). */
  checkPermissions?(): Promise<Record<string, string>>;
  requestPermissions?(): Promise<Record<string, string>>;
  addListener(
    eventName: "deviceFound",
    listenerFunc: (device: PosBluetoothPrinterDevice) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: "discoveryFinished",
    listenerFunc: () => void,
  ): Promise<{ remove: () => void }>;
};

export const PosBluetoothPrinter = registerPlugin<PosBluetoothPrinterPlugin>(
  "PosBluetoothPrinter",
);
