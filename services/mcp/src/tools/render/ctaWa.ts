/**
 * CTWA closer (click-to-WhatsApp ads): a chat button that pops and pulses, an optional location label that rises
 * from below, and an optional brand name. Colours come from the Gaya baku teks line about the CTWA closer
 * (for example "Penutup iklan CTWA: tombol hijau WhatsApp #25D366 ..., nama brand krem #F7F3EA dengan garis tepi
 * maroon") and the brand colour line; without them neutral defaults are used, never another organization's colours.
 * Needs Agent 0.1.23+ (anim wa_button and rise).
 */
import { z } from "zod";
import type { CatalogTextBlocks } from "../../db/catalog";
import type { RenderSpecV1 } from "./renderSpec";
import { extractHexColors, luminance } from "./draft";

export const ctaWaInput = z
  .object({
    /** Words on the button. */
    button_text: z.string().trim().min(1).max(40).optional(),
    /** Location label under the button (for example where to enter). */
    location_text: z.string().trim().min(1).max(60).optional(),
    /** Brand name above the button. */
    brand_text: z.string().trim().min(1).max(40).optional(),
    /** Seconds on the final video; default: the last voice over row (or the last 3 s before the closer). */
    start: z.number().finite().min(0).max(3600).optional(),
    end: z.number().finite().min(0).max(3600).optional(),
  })
  .strict()
  .refine((c) => c.start === undefined || c.end === undefined || c.end > c.start, { message: "end must be after start" });

export type CtaWaInput = z.infer<typeof ctaWaInput>;

export const CTA_AGENT_VERSION = "0.1.23";
export const CTA_STYLE_KEYS = ["cta_wa", "cta_lokasi", "cta_brand"] as const;

function line(teks: string, re: RegExp): string {
  return teks.split(/\r?\n/).find((l) => re.test(l)) ?? "";
}

/** Hex colour written right after a colour word anywhere in the text ("maroon #7A181E"). */
function hexAfter(teks: string, word: string): string | null {
  const m = new RegExp(`${word}\\s*\\(?\\s*(#[0-9a-fA-F]{6})`, "i").exec(teks);
  return m ? m[1]!.toUpperCase() : null;
}

export function ctaStyles(gaya: CatalogTextBlocks): Record<(typeof CTA_STYLE_KEYS)[number], RenderSpecV1["styles"][string]> {
  const teks = gaya.teks ?? "";
  const closer = line(teks, /penutup[^\n]*(ctwa|whats\s?app)/i);
  const hx = extractHexColors(closer);
  const green = hx.find((h) => {
    const n = parseInt(h.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return g > r + 40 && g > b + 20;
  });
  const brandFill = hexAfter(closer, "krem") ?? hx.find((h) => luminance(h) > 0.8 && h !== green) ?? "#FFFFFF";
  const brandStroke = /maroon/i.test(closer) ? hexAfter(teks, "maroon") : null;
  return {
    cta_wa: { size: 9, color: "#FFFFFF", bg: green ?? "#25D366", bg_alpha: 1, bold: true, font: "poppins", y: -0.2, max_width: 0.8 },
    cta_lokasi: { size: 7, color: "#FFFFFF", bg: "#000000", bg_alpha: 0.6, bold: true, font: "poppins", y: -0.36, max_width: 0.8 },
    cta_brand: {
      size: 13,
      color: brandFill,
      stroke: brandStroke ?? "#000000",
      stroke_width: 0.14,
      bold: true,
      font: "poppins",
      // Just above the button, so the whole closer sits in the lower third and never covers a sign or emblem
      // that storefront footage usually shows higher up.
      y: -0.04,
      max_width: 0.9,
    },
  };
}

/** The closer texts, timed inside [start, end]. */
export function ctaTexts(cta: CtaWaInput, start: number, end: number): RenderSpecV1["texts"] {
  const out: RenderSpecV1["texts"] = [];
  if (cta.brand_text) out.push({ text: cta.brand_text, start, end, style: "cta_brand", anim: "pop" });
  out.push({ text: cta.button_text ?? "Chat WhatsApp", start: Math.min(end - 0.4, start + 0.15), end, style: "cta_wa", anim: "wa_button" });
  if (cta.location_text) out.push({ text: cta.location_text, start: Math.min(end - 0.4, start + 0.35), end, style: "cta_lokasi", anim: "rise" });
  return out;
}
