import {
  PosPrinterUnavailableError,
  type PosPrinterBridge,
} from "../PosPrinterBridge";

/** Browser / non-Android stub — UI and storage still work. */
export function createUnavailablePrinterBridge(): PosPrinterBridge {
  const reject = async (): Promise<never> => {
    throw new PosPrinterUnavailableError();
  };

  return {
    isAvailable: async () => false,
    getAdapterEnabled: async () => false,
    requestEnable: reject,
    listBondedDevices: async () => [],
    startDiscovery: async () => {
      throw new PosPrinterUnavailableError();
    },
    stopDiscovery: async () => undefined,
    connect: reject,
    disconnect: async () => undefined,
    printRaw: reject,
  };
}
