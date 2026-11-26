import { describe, expect, it } from "vitest";
import { previewRenderJobResult } from "../src/tools/render/jobs";
import { renderSpecV1 } from "../src/tools/render/renderSpec";
import {
  bannedPhrases,
  checkSpec,
  footageFindings,
  hitsBannedPhrase,
  referenceFindings,
  ruleLevels,
  specCheckPasses,
} from "../src/tools/render/specChecks";

/** Gaya baku lines as Sate Sultan PIK has them (abridged). */
const gaya = {
  vo: '- Hindari kata lebay/klise: "bikin merem", "lumer di mulut", "auto nagih", "the best", "surga dunia", dan kalimat yang udah sering kepake ("tulangnya gede, sumsumnya tinggal sedot").',
  musik: "- Konten ASMR / tanpa VO: pakai suara asli (sizzle, sruput), musik cuma masuk di penutup.",
};

/** The spec of 24 Nov 2026 (v2) that had last night's mistakes in it. */
const v2 = renderSpecV1.parse({
  version: 1,
  production: "MG-test Malam di Sate Sultan PIK1",
  output_name: "Malam di Sate Sultan PIK1 v2 GayaBaku",
  shots: [
    { file_key: "PIK1/sate kambing/a.mp4", in: 0.5, out: 3.193 },
    { file_key: "PIK1/sop sumsum/b.mp4", in: 3.1, out: 9.5 },
    { file_key: "PIK1/sop sumsum/c.mp4", in: 0, out: 6 },
  ],
  audio: { music: { file: "musik/food.mp3", in: 20.18 } },
  styles: {
    sub: { size: 9, color: "#FFFFFF", y: -0.6 },
    menu: { size: 8, color: "#1A1A1A", bg: "#F6E27A", font: "instrument-serif", x: -0.42, y: -0.32 },
  },
  texts: [
    { text: "Sup Sumsum Kambing", start: 4.8, end: 6.7, style: "menu", anim: "menu_label" },
    { text: "kuahnya bening, bukan santan", start: 6.5, end: 8.7, style: "sub" },
    { text: "tinggal sedot.", start: 9, end: 10.3, style: "sub" },
  ],
  outro: { kind: "halftone", seconds: 1, logo: "brand/logo.png" },
});

const codes = (fs: Array<{ code: string }>) => fs.map((f) => f.code).sort();

describe("spec checks catch last night's mistakes", () => {
  it("reads quoted phrases from Gaya baku 'Hindari' lines and matches a shortened version", () => {
    expect(bannedPhrases(gaya)).toContain("tulangnya gede, sumsumnya tinggal sedot");
    expect(hitsBannedPhrase("tinggal sedot.", "tulangnya gede, sumsumnya tinggal sedot")).toBe(true);
    expect(hitsBannedPhrase("lumernya di sendok", "lumer di mulut")).toBe(false);
  });

  it("ketat: every style rule from last night is required", () => {
    const r = checkSpec(v2, { ...gaya, "aturan": "preset: ketat" });
    expect(r.preset).toBe("ketat");
    expect(codes(r.required)).toEqual(
      ["banned_phrase", "menu_covers_food", "output_name_format", "production_subfolder", "production_subfolder", "sub_overlaps_menu"].sort(),
    );
    expect(codes(r.suggestions)).toEqual(["no_vo_original_sound"]);
    expect(specCheckPasses(r)).toBe(false);
  });

  it("seimbang (no box): the same issues only warn and never block", () => {
    const r = checkSpec(v2, gaya);
    expect(r.preset).toBe("seimbang");
    expect(r.required).toEqual([]);
    expect(codes(r.suggestions)).toEqual(["banned_phrase", "menu_covers_food", "no_vo_original_sound", "sub_overlaps_menu"].sort());
    expect(specCheckPasses(r)).toBe(true);
  });

  it("bebas turns style rules off; per-rule lines override the preset", () => {
    expect(checkSpec(v2, { ...gaya, "aturan": "preset: bebas" }).suggestions).toEqual([]);
    const lv = ruleLevels({ "aturan": "preset: bebas\n- sub_overlaps_menu: wajib" });
    expect(lv.levels.sub_overlaps_menu).toBe("wajib");
    expect(lv.levels.menu_covers_food).toBe("mati");
  });

  it("a wajib rule can be kept for one video with a reason; a technical error cannot", () => {
    const strict = { ...gaya, "aturan": "preset: bebas\nmenu_covers_food: wajib" };
    const kept = checkSpec(v2, strict, [{ code: "menu_covers_food", reason: "shot reveal, sengaja di tengah" }]);
    expect(kept.required).toEqual([]);
    expect(kept.overridden.map((o) => o.reason)).toEqual(["shot reveal, sengaja di tengah"]);
    expect(specCheckPasses(kept)).toBe(true);

    const late = renderSpecV1.parse({ ...v2, texts: [{ text: "telat", start: 30, end: 31, style: "sub" }] });
    const r = checkSpec(late, { "aturan": "preset: bebas" }, [{ code: "text_outside_video", reason: "coba lewati" }]);
    expect(codes(r.errors)).toEqual(["text_outside_video"]);
    expect(specCheckPasses(r)).toBe(false);
  });

  it("render.jobs.create.preview refuses to queue while a wajib finding is open, and gives no confirm token", async () => {
    const out = await previewRenderJobResult(
      { userId: "u", organizationId: "o" } as never,
      { title: "v2", spec: v2 },
      async () => {
        throw new Error("must not reach the database");
      },
      async () => {
        throw new Error("must not sign");
      },
      async () => ({ ...gaya, "aturan": "preset: ketat" }),
    );
    expect(out.error).toBe("spec_check_failed");
    expect(out).not.toHaveProperty("confirm_token");
  });
});

describe("footage checks stop a render the Agent cannot finish", () => {
  /** Catalog as on 24 Nov 2026: AI clips are exactly 10.00 s long. */
  const catalog: Record<string, number> = { "PIK1/sate kambing/a.mp4": 10, "PIK1/sop sumsum/b.mp4": 10, "PIK1/sop sumsum/c.mp4": 10 };
  const lookup = async (k: string) => (k in catalog ? { duration_seconds: catalog[k]! } : null);
  const sateV1 = renderSpecV1.parse({
    version: 1,
    production: "379e87fc Sate Kambing",
    output_name: "379e87fc_Sate_Kambing_Full_Daging_VO_v1_9x16",
    shots: [
      { file_key: "PIK1/sate kambing/a.mp4", in: 8.2, out: 10.03 },
      { file_key: "PIK1/sop sumsum/b.mp4", in: 1, out: 9.95 },
    ],
  });

  it("flags a shot that ends past its clip (the 537 of 538 frames failure) as a technical error", async () => {
    const found = await footageFindings(sateV1, lookup);
    expect(codes(found)).toEqual(["shot_past_clip_end"]);
    expect(found[0]!.message).toContain("9.95");
    const r = checkSpec(sateV1, {}, [{ code: "shot_past_clip_end", reason: "coba lewati" }], found);
    expect(specCheckPasses(r)).toBe(false);
  });

  it("flags a file_key the catalog does not have", async () => {
    const typo = renderSpecV1.parse({ ...sateV1, shots: [{ file_key: "INBOX/tes.mp4", in: 0, out: 5 }] });
    expect(codes(await footageFindings(typo, lookup))).toEqual(["footage_unknown"]);
  });

  it("passes when every shot stays inside its clip", async () => {
    const ok = renderSpecV1.parse({ ...sateV1, shots: [{ file_key: "PIK1/sate kambing/a.mp4", in: 8.2, out: 9.95 }] });
    expect(await footageFindings(ok, lookup)).toEqual([]);
  });

  it("render.jobs.create.preview refuses the 10.03 s spec before anything is queued", async () => {
    const out = await previewRenderJobResult(
      { userId: "u", organizationId: "o" } as never,
      { title: "v1", spec: sateV1 },
      async () => {
        throw new Error("must not reach the database");
      },
      async () => {
        throw new Error("must not sign");
      },
      async () => ({ "aturan": "preset: bebas" }),
      async (_ctx, k) => lookup(k),
    );
    expect(out.error).toBe("spec_check_failed");
    expect(codes((out.checks as { errors: Array<{ code: string }> }).errors)).toEqual(["shot_past_clip_end"]);
  });
});

describe("reference check (creativity): a suggestion, never a block", () => {
  const refs = [
    { id: "r4", title: "Malam sate asap" },
    { id: "r7", title: null },
  ];
  it("suggests the available references when the draft names none and gives no reason", () => {
    const [f] = referenceFindings({}, {}, refs);
    expect(f).toMatchObject({ code: "reference_unused", level: "saran" });
    expect(f!.message).toContain("r4 (Malam sate asap), r7");
  });
  it("is quiet when references are used, or a reason is given, or the org has none", () => {
    expect(referenceFindings({}, { references: ["r4"] }, refs)).toEqual([]);
    expect(referenceFindings({}, { no_reference_reason: "brief minta format testimoni polos" }, refs)).toEqual([]);
    expect(referenceFindings({}, {}, [])).toEqual([]);
  });
  it("flags an id the catalog does not have, and stays a suggestion even when aturan says wajib", () => {
    const [f] = referenceFindings({ aturan: "reference_unused: wajib" }, { references: ["r99"] }, refs);
    expect(f).toMatchObject({ level: "saran" });
    expect(f!.message).toContain("r99");
  });
  it("is off with preset bebas", () => {
    expect(referenceFindings({ aturan: "preset: bebas" }, {}, refs)).toEqual([]);
  });
});

describe("org libraries and still preview", () => {
  const spec = renderSpecV1.parse({
    version: 1,
    production: "769b1513 4 Green Flag Sop Sumsum",
    output_name: "769b1513_Green_Flag_VO_v4_9x16",
    shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 2 }],
    audio: { vo_parts: [{ file: "vo/vo-9.mp3", at: 0 }], music: { file: "@musik/capcut/Food - Guz Aleksei Igorevich.mp3", in: 3 } },
    outro: { kind: "halftone", logo: "@brand/logo.png" },
    stills: [1, 5.5],
  });

  it("accepts stills (max 12) and @library paths", () => {
    expect(spec.stills).toEqual([1, 5.5]);
    expect(() => renderSpecV1.parse({ ...spec, stills: Array.from({ length: 13 }, (_, i) => i) })).toThrow();
    expect(() => renderSpecV1.parse({ ...spec, stills: [] })).toThrow();
  });

  it("production_subfolder lets @musik/ and @brand/ through, still flags other folders", () => {
    const r = checkSpec(spec, { aturan: "preset: ketat" });
    expect(r.required.filter((c) => c.code === "production_subfolder")).toEqual([]);
    const loose = renderSpecV1.parse({ ...spec, audio: { music: { file: "musik/food.mp3" } } });
    expect(checkSpec(loose, { aturan: "preset: ketat" }).required.map((c) => c.code)).toContain("production_subfolder");
  });
});
