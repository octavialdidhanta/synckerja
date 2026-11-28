/**
 * Where the Agent renderer (synckerja-agent remotion/AgentReel.tsx) draws a text box on the 1080x1920 frame, so the
 * draft can catch a label that would be cut off before a still preview. Keep in step with the renderer:
 * - font px = size × 6.5; box padding = 0.45 × px when the style has a background;
 * - x/y like CapCut (-1..1, y up): centre x = 540 + x × 540;
 * - anim "menu_label" is anchored at its left edge and grows to the right, never past the right edge minus 40 px
 *   (it wraps instead) and types about 20 characters per second;
 * - every other box is centred on x and wraps inside max_width.
 * Text width is estimated on the low side (half an em per character), so an off-screen finding is certain.
 */
import type { RenderSpecV1 } from "./renderSpec";

type Style = RenderSpecV1["styles"][string];
type Text = RenderSpecV1["texts"][number];

export const FRAME_W = 1080;
export const MENU_RIGHT_MARGIN = 40;
export const MENU_CHARS_PER_SECOND = 20;
const MIN_EM_PER_CHAR = 0.5;

export function fontPx(style: Style): number {
  return style.size * 6.5;
}

export function boxPad(style: Style): number {
  return style.bg ? fontPx(style) * 0.45 : 0;
}

export function centreX(style: Style): number {
  return FRAME_W / 2 + (style.x ?? 0) * (FRAME_W / 2);
}

/** Widest the left-anchored menu_label box can get (the renderer's menuMaxWidth). */
export function menuMaxWidth(left: number, maxWidth = 0.9): number {
  return Math.max(120, Math.min(maxWidth * FRAME_W, FRAME_W - MENU_RIGHT_MARGIN - left));
}

function longestLineChars(text: string): number {
  return Math.max(...text.split(/\r?\n/).map((l) => Array.from(l).length), 0);
}

/** Smallest left and right edge the box can have (px). */
export function boxEdges(text: Text, style: Style): { left: number; right: number } {
  const px = fontPx(style);
  const pad = boxPad(style);
  const est = longestLineChars(text.text) * px * MIN_EM_PER_CHAR + 2 * pad;
  const cx = centreX(style);
  if (text.anim === "menu_label") {
    const w = Math.min(est, menuMaxWidth(cx, style.max_width));
    return { left: cx, right: cx + w };
  }
  const w = Math.min(est, (style.max_width ?? 0.9) * FRAME_W);
  return { left: cx - w / 2, right: cx + w / 2 };
}

/** Lines a menu_label label is likely to need (estimate). */
export function menuLines(text: Text, style: Style): number {
  const px = fontPx(style);
  const inner = menuMaxWidth(centreX(style), style.max_width) - 2 * boxPad(style);
  // Measured on Agent still previews (Nov 2026): Instrument Serif runs about 0.30–0.33 em per character.
  const emPerChar = style.font === "instrument-serif" ? 0.36 : 0.58;
  const perLine = Math.max(1, Math.floor(inner / (px * emPerChar)));
  const words = text.text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let used = 0;
  for (const w of words) {
    const len = Array.from(w).length;
    const need = used === 0 ? len : used + 1 + len;
    if (need <= perLine) used = need;
    else {
      lines++;
      used = len;
    }
  }
  return lines;
}

/** Seconds menu_label needs to finish typing this text. */
export function menuTypingSeconds(text: string): number {
  return Math.max(0, Array.from(text).length - 1) / MENU_CHARS_PER_SECOND;
}

/**
 * Smallest rectangle the box surely covers (px, y down): width and line count estimated on the low side, so an
 * overlap between two of these is certain.
 */
export function boxRect(text: Text, style: Style): { left: number; right: number; top: number; bottom: number } {
  const { left, right } = boxEdges(text, style);
  const px = fontPx(style);
  const pad = boxPad(style);
  const inner = Math.max(1, right - left - 2 * pad);
  const lines = text.text
    .split(/\r?\n/)
    .reduce((n, l) => n + Math.max(1, Math.ceil((Array.from(l).length * px * MIN_EM_PER_CHAR) / inner - 1e-9)), 0);
  const height = lines * px * 1.15 + 2 * pad;
  const cy = 960 - (style.y ?? 0) * 960;
  return { left, right, top: cy - height / 2, bottom: cy + height / 2 };
}
