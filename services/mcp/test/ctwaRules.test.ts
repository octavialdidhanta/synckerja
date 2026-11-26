import { describe, expect, it } from "vitest";
import { buildDraftSpec, defaultRenderStyles, gayaAnimations, gayaSize, judulLabelStyle } from "../src/tools/render/draft";
import { renderSpecV1 } from "../src/tools/render/renderSpec";
import { brandSpellings, checkSpec, hitsAvoidedSpelling, mentionsPrice } from "../src/tools/render/specChecks";

/** Gaya baku boxes as Sate Sultan PIK has them since 26 Nov 2026 (abridged). */
const gaya = {
  aturan: "preset: ketat",
  vo: [
    '- Sebut lokasi "Pik" (dibaca satu kata), bukan "P.I.K".',
    "- WAJIB untuk iklan CTWA Sate Sultan PIK:",
    '  - Semua iklan ditutup ajakan chat WhatsApp dengan bahasa natural (contoh: "Klik WhatsApp, pesan duluan.").',
    "  - Jangan sebut harga, baik di VO, teks layar, maupun caption.",
    '  - Nama brand ditulis "Sate Sultan PIK" dan diucapkan "Sate Sultan Pik" (bukan "P.I.K", bukan cuma "Sate Sultan").',
  ].join("\n"),
  teks: [
    "- Hook: teks besar kuning #FFD640 (baris kedua boleh putih), Poppins Bold, garis tepi hitam, muncul pop per baris dengan getar kecil. Ukuran besar (±17), di sepertiga atas layar.",
    "- Subtitle (STANDAR, dari Rocky's BBQ): Poppins Bold krem #FAF8B2 dengan garis tepi/bayangan gelap #282000. Tanpa animasi, langsung ganti tiap frasa (cut).",
    "- Subtitle VARIAN (hanya bila diminta): putih garis tepi hitam, kata yang lagi diucapkan jadi kuning #FFD640 dan sedikit membesar.",
    '- Judul / langkah (dari Rocky\'s BBQ, contoh "Langkah 1"): kotak kuning #FAFD96, tulisan #111111, Instrument Serif, ukuran minimal 15.',
    "- Area aman: teks di antara 14% atas dan 20% bawah layar.",
  ].join("\n"),
};

function spec(texts: Array<{ text: string; start: number; end: number; style?: string }>) {
  return renderSpecV1.parse({
    version: 1,
    production: "P1 Tes",
    output_name: "P1_tes_VO_v1_9x16",
    shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 10 }],
    audio: { vo: { file: "vo/VO_full.mp3" } },
    styles: { sub: { size: 9 }, hook: { size: 17 } },
    texts: texts.map((t) => ({ style: "sub", ...t })),
  });
}

describe("CTWA rules from Gaya baku", () => {
  it("spots prices", () => {
    expect(mentionsPrice("SOP SUMSUM CUMA RP 45 RIBU")).toBe(true);
    expect(mentionsPrice("cuma 45rb")).toBe(true);
    expect(mentionsPrice("harganya cuma 50")).toBe(true);
    expect(mentionsPrice("3 langkah ala Sate Sultan PIK")).toBe(false);
  });

  it("reads written and avoided brand spellings", () => {
    expect(brandSpellings({ teks: 'yang ditulis "varian" hanya dipakai bila diminta' }).preferred).toEqual([]);
    const b = brandSpellings(gaya);
    expect(b.preferred).toEqual(["Sate Sultan PIK"]);
    expect(b.avoid).toEqual(expect.arrayContaining(["P.I.K", "Sate Sultan"]));
    expect(hitsAvoidedSpelling("di Sate Sultan PIK.", "Sate Sultan", b.preferred)).toBe(false);
    expect(hitsAvoidedSpelling("makan di Sate Sultan aja", "Sate Sultan", b.preferred)).toBe(true);
    expect(hitsAvoidedSpelling("cabang P.I.K", "P.I.K", b.preferred)).toBe(true);
  });

  it("blocks price and spelling (wajib), suggests the missing WhatsApp CTA", () => {
    const r = checkSpec(
      spec([
        { text: "SOP SUMSUM CUMA RP 45 RIBU", start: 0, end: 2, style: "hook" },
        { text: "Datang ke Sate Sultan di P.I.K", start: 2, end: 4 },
      ]),
      gaya,
    );
    const codes = r.required.map((f) => f.code);
    expect(codes).toContain("price_mentioned");
    expect(codes).toContain("brand_spelling");
    expect(r.suggestions.map((f) => f.code)).toContain("cta_wa_missing");
  });

  it("passes a clean CTWA closing", () => {
    const r = checkSpec(
      spec([
        { text: "Ini cara makan sumsum di Sate Sultan PIK.", start: 0, end: 3 },
        { text: "Klik WhatsApp, pesan duluan.", start: 8, end: 9.5 },
      ]),
      gaya,
    );
    expect(r.required).toEqual([]);
    expect(r.suggestions.map((f) => f.code)).not.toContain("cta_wa_missing");
  });
});

describe("draft defaults follow the per-element Gaya baku lines", () => {
  it("hook Poppins ±17, cream subtitle without animation, yellow typed title", () => {
    const st = defaultRenderStyles(gaya);
    expect(st.hook).toMatchObject({ size: 17, font: "poppins", color: "#FFD640" });
    expect(st.sub).toMatchObject({ color: "#FAF8B2", stroke: "#282000" });
    expect(gayaAnimations(gaya)).toMatchObject({ hook: "pop_shake", sub: "none", highlight: null });
    expect(judulLabelStyle(gaya)).toMatchObject({ bg: "#FAFD96", color: "#111111", font: "instrument-serif", size: 15 });
    expect(gayaSize("ukuran minimal 15")).toBe(15);
  });

  it("judul texts type in with the growing box", () => {
    const { spec: s } = buildDraftSpec(
      {
        title: "t",
        production: "P1 Tes",
        output_name: "P1_tes_VO_v1_9x16",
        shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 5 }],
        texts: [{ text: "Langkah 1", start: 1, end: 2.2, style: "judul" }],
      },
      gaya,
    );
    expect(s.texts[0]).toMatchObject({ style: "judul", anim: "menu_label" });
    expect(s.styles.judul).toMatchObject({ size: 15 });
  });
});
