import { describe, expect, it } from "vitest";
import { checkSpec } from "../src/tools/render/specChecks";
import { ctaStyles } from "../src/tools/render/ctaWa";
import { draftRenderJobResult } from "../src/tools/render/draft";
import { renderSpecV1 } from "../src/tools/render/renderSpec";
import { menuLines } from "../src/tools/render/textLayout";

const ctx = { userId: "u", organizationId: "o" } as never;
const base = { version: 1 as const, production: "p", output_name: "o_v1_9x16", shots: [{ file_key: "a.mp4", in: 0, out: 40 }], audio: {} };
const spec = (styles: Record<string, unknown>, texts: unknown[]) => renderSpecV1.parse({ ...base, styles, texts });
const codes = (s: ReturnType<typeof spec>) => checkSpec(s, {}).errors.map((e) => e.code);

const GAYA = {
  teks: [
    "- Penutup iklan CTWA: tombol hijau WhatsApp #25D366 pop lalu berdenyut, label lokasi hitam transparan naik dari bawah, nama brand krem #F7F3EA dengan garis tepi maroon.",
    "- Warna brand: maroon #7A181E, krem #F7F3EA, kuning #FFD640.",
  ].join("\n"),
  vo: "- WAJIB untuk iklan CTWA: Semua iklan ditutup ajakan chat WhatsApp dengan bahasa natural.",
};

describe("text_off_screen on real specs", () => {
  it("passes labels that rendered fine (revisi v5 info, Hidden Gem left-anchored judul)", () => {
    const s = spec(
      {
        info: { x: -0.3, y: -0.42, bg: "#7A181E", bold: true, font: "poppins", size: 8, color: "#FFFFFF", bg_alpha: 1, max_width: 0.8 },
        judul: { x: -0.88, y: 0.82, bg: "#FAFD96", font: "instrument-serif", size: 13, color: "#111111", bg_alpha: 1, max_width: 0.86 },
        hook: { y: 0.72, bold: true, font: "poppins", size: 17, color: "#FFD640", stroke: "#000000", max_width: 0.88, stroke_width: 0.14 },
      },
      [
        { text: "Gate sebelah Bank DBS PIK", start: 29.6, end: 33.7, style: "info", anim: "slide" },
        { text: "1. Gate sebelah Bank DBS", start: 4.3, end: 10.5, style: "judul", anim: "menu_label" },
        { text: "3 LANGKAH ALA SATE SULTAN PIK", start: 4, end: 7, style: "hook", anim: "pop_shake" },
      ],
    );
    expect(codes(s)).toEqual([]);
  });

  it("catches the cut-off labels: centred long judul (still 1 revisi v5) and info at x -0.9 (Sate Kambing v3)", () => {
    const s = spec(
      {
        judul: { x: -0.3, y: 0.5, bg: "#FAFD96", font: "instrument-serif", size: 16, color: "#111111", bg_alpha: 1, max_width: 0.84 },
        info: { x: -0.9, y: -0.7, bg: "#7A181E", bold: true, font: "poppins", size: 8, color: "#FFFFFF", bg_alpha: 1, max_width: 0.34 },
      },
      [
        { text: "Langkah 2: Ketuk pelan, sisa sumsum keluar", start: 13, end: 16, style: "judul", anim: "typewriter" },
        { text: "Sate Sultan PIK 1", start: 21, end: 22.4, style: "info", anim: "slide" },
      ],
    );
    const errs = checkSpec(s, {}).errors.filter((e) => e.code === "text_off_screen");
    expect(errs).toHaveLength(2);
    expect(errs[0]!.message).toMatch(/menu_label/);
  });
});

describe("menu_label typing and length", () => {
  const judul = { x: -0.42, y: 0.62, bg: "#FAFD96", font: "instrument-serif", size: 16, color: "#111111", bg_alpha: 1, max_width: 0.8 };
  it("refuses a label that disappears before it is typed; short labels pass", () => {
    const s = spec({ judul }, [
      { text: "Langkah 2: Ketuk pelan, sisa sumsum keluar", start: 1, end: 2.9, style: "judul", anim: "menu_label" },
      { text: "Langkah 1", start: 0, end: 0.9, style: "judul", anim: "menu_label" },
    ]);
    expect(codes(s)).toEqual(["label_typing_unfinished"]);
  });

  it("suggests (never blocks) a label over two lines", () => {
    const t = { text: "Langkah 2: Ketuk pelan, sisa sumsum keluar", start: 1, end: 4, style: "judul", anim: "menu_label" as const };
    expect(menuLines(t as never, judul as never)).toBeGreaterThan(2);
    const r = checkSpec(spec({ judul }, [t]), { aturan: "preset: ketat" });
    expect(r.errors).toEqual([]);
    expect(r.required).toEqual([]);
    expect(r.suggestions.map((f) => f.code)).toContain("label_too_long");
    expect(menuLines({ ...t, text: "Langkah 1" } as never, judul as never)).toBe(1);
  });
});

describe("cta_wa closer", () => {
  it("takes the button, brand and stroke colours from Gaya baku; neutral defaults without them", () => {
    const s = ctaStyles(GAYA);
    expect(s.cta_wa.bg).toBe("#25D366");
    expect(s.cta_brand.color).toBe("#F7F3EA");
    expect(s.cta_brand.stroke).toBe("#7A181E");
    const n = ctaStyles({});
    expect(n.cta_wa.bg).toBe("#25D366");
    expect(n.cta_brand.color).toBe("#FFFFFF");
    expect(n.cta_brand.stroke).toBe("#000000");
  });

  it("draft adds the closer inside the last VO row, before the halftone, and satisfies cta_wa_missing", async () => {
    const lookupVoice = async (_c: unknown, _p: string, row: number) =>
      ({ 0: { duration_seconds: 3, words: [], file_name: "vo-1.mp3" }, 1: { duration_seconds: 4, words: [], file_name: "vo-2.mp3" } } as never)[row] ?? null;
    const r = (await draftRenderJobResult(
      ctx,
      {
        title: "t",
        plan_id: "6d1ff665-7412-4bd2-b563-5f2a50e4f460",
        production: "p",
        output_name: "o_v1_9x16",
        vo_rows: [
          { row_index: 0, shots: [{ file_key: "a.mp4" }] },
          { row_index: 1, shots: [{ file_key: "b.mp4" }] },
        ],
        outro: "halftone",
        cta_wa: { button_text: "Chat WhatsApp", location_text: "Gate sebelah bank", brand_text: "Brand Kita" },
      },
      async () => GAYA,
      async () => ({ duration_seconds: 20 }),
      undefined,
      undefined,
      lookupVoice as never,
    )) as {
      spec: { texts: Array<{ text: string; start: number; end: number; style: string; anim: string }>; styles: Record<string, { bg?: string }> };
      vo_timeline: Array<{ start: number; end: number }>;
      checks: { errors: unknown[]; suggestions: Array<{ code: string }> };
      warnings: string[];
    };
    const cta = r.spec.texts.filter((t) => t.style.startsWith("cta_"));
    expect(cta.map((t) => [t.style, t.anim])).toEqual([
      ["cta_brand", "pop"],
      ["cta_wa", "wa_button"],
      ["cta_lokasi", "rise"],
    ]);
    const last = r.vo_timeline.at(-1)!;
    expect(cta[1]!.end).toBeLessThanOrEqual(last.end + 0.01);
    expect(cta[0]!.start).toBeCloseTo(last.start, 1);
    expect(r.spec.styles.cta_wa!.bg).toBe("#25D366");
    expect(r.checks.errors).toEqual([]);
    expect(r.checks.suggestions.map((s) => s.code)).not.toContain("cta_wa_missing");
    expect(r.warnings.some((w) => /Agent v0\.1\.23/.test(w))).toBe(true);
  });
});
