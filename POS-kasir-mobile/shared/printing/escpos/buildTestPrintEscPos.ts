import {
  encodeEscPosText,
  escPosDivider,
} from "./encodeEscPosText";

/** Short ESC/POS page used to verify Bluetooth SPP connect + print. */
export function buildTestPrintEscPos(opts?: {
  printerName?: string | null;
  outletName?: string | null;
}): Uint8Array {
  const width = 32;
  const name = (opts?.printerName ?? "").trim() || "Printer";
  const outlet = (opts?.outletName ?? "").trim() || "Synckerja POS";
  const when = new Date().toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return encodeEscPosText(
    [
      outlet.slice(0, width),
      "TEST PRINT",
      escPosDivider(width),
      name.slice(0, width),
      when.slice(0, width),
      escPosDivider(width),
      "OK - Bluetooth connected",
      "",
    ],
    { width },
  );
}
