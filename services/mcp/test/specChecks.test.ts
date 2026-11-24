import { describe, expect, it } from "vitest";
import { previewRenderJobResult } from "../src/tools/render/jobs";
import { renderSpecV1 } from "../src/tools/render/renderSpec";
import { bannedPhrases, checkSpec, hitsBannedPhrase, ruleLevels, specCheckPasses } from "../src/tools/render/specChecks";

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
