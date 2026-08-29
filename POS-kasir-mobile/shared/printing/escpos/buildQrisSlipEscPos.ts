/**
 * ESC/POS QR Code (Model 2) + text slip for thermal receipt printers.
 * Uses GS ( k commands (Epson-compatible).
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function sanitizeAscii(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pushTextLine(out: number[], text: string, width = 32): void {
  const safe = sanitizeAscii(text).slice(0, width);
  for (let i = 0; i < safe.length; i++) out.push(safe.charCodeAt(i) & 0xff);
  out.push(LF);
}

function pushCentered(out: number[], text: string, width = 32): void {
  const safe = sanitizeAscii(text).slice(0, width);
  const pad = Math.max(0, Math.floor((width - safe.length) / 2));
  pushTextLine(out, `${" ".repeat(pad)}${safe}`, width);
}

function pushQrCode(out: number[], data: string, moduleSize = 6): void {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  // Model 2
  out.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Module size
  out.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize & 0xff);
  // Error correction M
  out.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // Store data
  const storeLen = dataBytes.length + 3;
  out.push(GS, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30);
  for (let i = 0; i < dataBytes.length; i++) out.push(dataBytes[i]!);
  // Print
  out.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
}

export type PosQrisSlipPrintInput = {
  outletName: string;
  outletAddress?: string | null;
  amountLabel: string;
  qrString: string;
};

export function buildQrisSlipEscPos(input: PosQrisSlipPrintInput): Uint8Array {
  const width = 32;
  const out: number[] = [];

  // Init
  out.push(ESC, 0x40);
  // Align center
  out.push(ESC, 0x61, 0x01);

  pushCentered(out, "QRIS", width);
  pushCentered(out, input.outletName, width);
  if (input.outletAddress?.trim()) {
    pushCentered(out, input.outletAddress.trim(), width);
  }
  out.push(LF);
  pushCentered(out, input.amountLabel, width);
  out.push(LF);

  pushQrCode(out, input.qrString.trim());
  out.push(LF);

  // Align left again
  out.push(ESC, 0x61, 0x00);
  // Feed + cut
  out.push(ESC, 0x64, 0x03);
  out.push(GS, 0x56, 0x00);

  return Uint8Array.from(out);
}
