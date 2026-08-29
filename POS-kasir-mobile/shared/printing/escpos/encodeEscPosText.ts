const ESC = 0x1b;
const GS = 0x1d;

export function encodeEscPosText(lines: string[], opts?: { width?: number }): Uint8Array {
  const width = opts?.width ?? 32;
  const chunks: number[] = [];

  // Initialize
  chunks.push(ESC, 0x40);

  for (const line of lines) {
    const wrapped = wrapLine(line, width);
    for (const part of wrapped) {
      for (let i = 0; i < part.length; i++) {
        chunks.push(part.charCodeAt(i) & 0xff);
      }
      chunks.push(0x0a);
    }
  }

  // Feed + partial cut
  chunks.push(ESC, 0x64, 0x03);
  chunks.push(GS, 0x56, 0x00);

  return Uint8Array.from(chunks);
}

function wrapLine(text: string, width: number): string[] {
  const safe = sanitizeAscii(text);
  if (safe.length <= width) return [safe];
  const parts: string[] = [];
  for (let i = 0; i < safe.length; i += width) {
    parts.push(safe.slice(i, i + width));
  }
  return parts;
}

/** Thermal printers typically expect ASCII / CP437-ish; strip unsupported chars. */
function sanitizeAscii(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

export function escPosDivider(width = 32, char = "-"): string {
  return char.repeat(width);
}

export function escPosColumns(
  left: string,
  right: string,
  width = 32,
): string {
  const l = sanitizeAscii(left);
  const r = sanitizeAscii(right);
  const space = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(space)}${r}`.slice(0, width);
}
