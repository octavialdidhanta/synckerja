import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_POS_BARCODE_SCANNER_SETTINGS,
  readPosBarcodeScannerSettings,
  writePosBarcodeScannerSettings,
} from "./posBarcodeScannerStorage";

describe("posBarcodeScannerStorage", () => {
  const outletId = "outlet-scan-test";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns defaults when empty", () => {
    expect(readPosBarcodeScannerSettings(outletId)).toEqual(
      DEFAULT_POS_BARCODE_SCANNER_SETTINGS,
    );
  });

  it("persists toggles", () => {
    writePosBarcodeScannerSettings(outletId, {
      ...DEFAULT_POS_BARCODE_SCANNER_SETTINGS,
      wedgeEnabled: false,
      productScanEnabled: false,
    });
    const next = readPosBarcodeScannerSettings(outletId);
    expect(next.wedgeEnabled).toBe(false);
    expect(next.productScanEnabled).toBe(false);
    expect(next.cameraEnabled).toBe(true);
  });
});
