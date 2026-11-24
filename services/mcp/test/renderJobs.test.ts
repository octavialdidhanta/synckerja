import { describe, expect, it } from "vitest";
import { applyRenderJob, previewRenderJob } from "../src/db/render";
import { MCP_TOOLS } from "../src/mcp/registry";
import { signFootageConfirmation, verifyFootageConfirmation } from "../src/tools/footage/confirmation";
import {
  buildDraftSpec,
  defaultMusicDb,
  defaultRenderStyles,
  draftRenderJobResult,
  extractHexColors,
  renderJobDraftInput,
} from "../src/tools/render/draft";
import { applyRenderJobResult, previewRenderJobResult, renderJobCreatePreviewInput } from "../src/tools/render/jobs";
import { renderSpecV1, specDuration } from "../src/tools/render/renderSpec";

const ctx = { userId: "user-1", organizationId: "org-1" } as never;
const secret = "test-secret-at-least-16";
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";

const spec = {
  version: 1,
  production: "bd995747 Hari 6 Coba",
  output_name: "bd995747_Hari6_v1_9x16",
  shots: [
    { file_key: "PIK1/sate babi/Basting_satay_7910de9b.mp4", in: 1.2, out: 3.4, label: "hook" },
    { file_key: "INBOX/C0002.MP4", in: 0, out: 1.5 },
  ],
  audio: { vo: { file: "vo/VO_full.mp3" }, music: { file: "_build/musik.mp3", db: -18, fade_out: 1 } },
  styles: { sub: { size: 9, color: "#FFFFFF", stroke: "#000000", stroke_width: 0.14, bold: true, y: -0.54 } },
  texts: [{ text: "Weekend rame!", start: 0.2, end: 2, style: "sub", anim: "pop" }],
};

function fakeAdmin(data: unknown) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return { admin: { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), { data, error: null }) } as never, calls };
}

describe("render job spec v1", () => {
  it("accepts a normal edit and sums frame-exact shot lengths", () => {
    const parsed = renderSpecV1.parse(spec);
    expect(specDuration(parsed)).toBeCloseTo(2.2 + 1.5, 5);
  });

  it("refuses paths that leave the production folder, unknown keys, unknown styles and empty shots", () => {
    const bad = (patch: Record<string, unknown>) => renderSpecV1.safeParse({ ...spec, ...patch }).success;
    expect(bad({ audio: { vo: { file: "../rahasia.mp3" } } })).toBe(false);
    expect(bad({ audio: { vo: { file: "D:/x.mp3" } } })).toBe(false);
    expect(bad({ production: "a/b" })).toBe(false);
    expect(bad({ output_name: "../x" })).toBe(false);
    expect(bad({ effects: ["halftone"] })).toBe(false);
    expect(bad({ texts: [{ text: "x", start: 0, end: 1, style: "nope" }] })).toBe(false);
    expect(bad({ shots: [] })).toBe(false);
    expect(bad({ shots: [{ file_key: "a.mp4", in: 2, out: 2 }] })).toBe(false);
    expect(bad({})).toBe(true);
  });

  it("accepts behind_person on texts for SAM+RVM layering", () => {
    const parsed = renderSpecV1.parse({
      ...spec,
      texts: [{ text: "di belakang", start: 0, end: 1.5, style: "sub", behind_person: true }],
    });
    expect(parsed.texts[0]?.behind_person).toBe(true);
  });
});

describe("render.jobs.create", () => {
  it("previews with a summary and confirm token, then queues on confirm", async () => {
    const { admin, calls } = fakeAdmin({ plan: { plan_id: "p1", title: "Hari 6", production_status: "" }, preview_id: previewId, expires_at: new Date(Date.now() + 60_000).toISOString() });
    const out = await previewRenderJobResult(
      ctx,
      { plan_id: "8c5e1b2e-5d7a-4a43-9c55-6a0f8e7a1b20", title: "Hari 6 render", spec },
      (c, input) => previewRenderJob(admin, c as never, input),
      (c, tool, id, exp) => signFootageConfirmation(secret, c as never, tool, id, exp),
    );
    expect(calls[0]?.fn).toBe("mcp_preview_render_job");
    expect(out.summary).toMatchObject({ shots: 2, texts: 1, vo: "vo/VO_full.mp3", uploads_to_plan: true });
    const saver = fakeAdmin({ saved: true, job_id: "j1", status: "queued" });
    const saved = await applyRenderJobResult(
      ctx,
      { confirm_token: out.confirm_token },
      (c, tool, token) => verifyFootageConfirmation(secret, c as never, tool, token),
      (c, id) => applyRenderJob(saver.admin, c as never, id),
    );
    expect(saved.job_id).toBe("j1");
    expect(saver.calls[0]?.args.p_preview_id).toBe(previewId);
  });

  it("explains which field is wrong", async () => {
    await expect(
      previewRenderJobResult(ctx, { title: "x", spec: { ...spec, shots: [] } }, async () => { throw new Error("unused"); }, async () => { throw new Error("unused"); }),
    ).rejects.toThrow(/invalid_input: spec\.shots/);
  });

  it("is registered as a write that needs confirmation, and the list is read only", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["render.jobs.draft", "render.jobs.create.preview", "render.jobs.create", "render.jobs.list"]),
    );
    expect(renderJobCreatePreviewInput.safeParse({ title: "x", spec, organization_id: "o2" }).success).toBe(false);
  });
});

describe("render.jobs.draft", () => {
  const draftArgs = {
    title: "Hari 6 render",
    production: "bd995747 Hari 6 Coba",
    output_name: "bd995747_Hari6_v1_9x16",
    plan_id: "8c5e1b2e-5d7a-4a43-9c55-6a0f8e7a1b20",
    shots: [
      { file_key: "PIK1/sate babi/Basting_satay_7910de9b.mp4", in: 1.2, out: 3.4, label: "hook" },
      { file_key: "INBOX/C0002.MP4", in: 0, out: 1.5 },
    ],
    vo_file: "vo/VO_full.mp3",
    music_file: "_build/musik.mp3",
    texts: [
      {
        text: "Weekend rame!",
        start: 0.2,
        end: 2,
        style: "hook" as const,
        anim: "pop" as const,
        behind_person: true,
      },
    ],
  };

  it("builds a valid spec with hook/sub styles and -18 dB music", () => {
    const { spec, warnings } = buildDraftSpec(renderJobDraftInput.parse(draftArgs), {
      teks: "Hook: kuning #FFD640. Area aman: 14% atas dan 20% bawah. Subtitle Poppins.",
      musik: "Volume musik sekitar -18 dB di bawah VO. Loudness -14 LUFS.",
    });
    expect(renderSpecV1.parse(spec).audio.music?.db).toBe(-18);
    expect(spec.styles.hook?.color).toBe("#FFD640");
    expect(spec.styles.hook?.y).toBe(0.72);
    expect(spec.styles.sub?.y).toBe(-0.6);
    expect(Object.keys(spec.styles)).toEqual(expect.arrayContaining(["hook", "sub"]));
    expect(spec.texts[0]?.style).toBe("hook");
    expect(spec.texts[0]?.behind_person).toBe(true);
    expect(warnings.some((w) => /Gaya teks diterapkan/.test(w))).toBe(true);
  });

  it("locks the menu label and a 1s halftone outro", () => {
    const { spec, warnings } = buildDraftSpec(
      renderJobDraftInput.parse({
        ...draftArgs,
        outro: "halftone",
        logo_file: "brand/emblem.png",
        texts: [{ text: "Sup Sumsum Kambing", start: 0.4, end: 2.2, style: "menu" as const }],
      }),
      { teks: "", musik: "" },
    );
    expect(spec.styles.menu).toMatchObject({
      color: "#1A1A1A",
      bg: "#F6E27A",
      font: "instrument-serif",
      x: -0.42,
      y: -0.5,
    });
    expect(spec.texts[0]?.anim).toBe("menu_label");
    expect(spec.outro).toEqual({ kind: "halftone", seconds: 1, logo: "brand/emblem.png" });
    expect(renderSpecV1.parse(spec).outro?.kind).toBe("halftone");
    expect(warnings.some((w) => /logo_file diabaikan/.test(w))).toBe(false);
  });

  it("warns when halftone has no logo and still refuses a free effects list", () => {
    const { spec, warnings } = buildDraftSpec(
      renderJobDraftInput.parse({ ...draftArgs, outro: "halftone", texts: [] }),
      { teks: "x", musik: "x" },
    );
    expect(spec.outro).toEqual({ kind: "halftone", seconds: 1 });
    expect(warnings.some((w) => /tanpa emblem/.test(w))).toBe(true);
    expect(renderSpecV1.safeParse({ ...spec, effects: ["halftone"] }).success).toBe(false);
  });

  it("parses music dB and hex colors from Gaya", () => {
    expect(extractHexColors("maroon #7A181E kuning #FFD640")).toEqual(["#7A181E", "#FFD640"]);
    expect(defaultMusicDb({ musik: "musik -16 dB di bawah VO" })).toBe(-16);
    expect(defaultRenderStyles({ teks: "" }).hook?.color).toBe("#FFFFFF");
  });

  it("warns when audio or gaya is missing, and blocks an unknown file_key as a technical error", async () => {
    const out = await draftRenderJobResult(
      ctx,
      { ...draftArgs, vo_file: undefined, music_file: undefined },
      async () => ({}),
      async () => null,
    );
    expect(out.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Tidak ada VO\/musik/),
        expect.stringMatching(/teks/),
      ]),
    );
    const checks = out.checks as { errors: Array<{ code: string }> };
    expect(checks.errors.map((e) => e.code)).toContain("footage_unknown");
    expect(out.next_step).toMatch(/create\.preview/);
    expect((out.summary as { duration_seconds: number }).duration_seconds).toBeCloseTo(3.7, 5);
  });

  it("returns brief_hints for plan_id without auto-picking footage", async () => {
    const out = await draftRenderJobResult(
      ctx,
      draftArgs,
      async () => ({ teks: "Hook #FFD640", musik: "-18 dB" }),
      async () => ({ file_key: "x", duration_seconds: 10 }),
      async () => ({ title: "Hari 5", caption: "CTA chat dulu", voice_over: "Rame banget weekend" }),
    );
    expect(out.brief_hints).toMatchObject({
      title: "Hari 5",
      caption: "CTA chat dulu",
      suggested_vo_file: null,
    });
    const noVo = await draftRenderJobResult(
      ctx,
      { ...draftArgs, vo_file: undefined },
      async () => ({ teks: "x", musik: "x" }),
      undefined,
      async () => ({ title: "T", caption: null, voice_over: "Ada VO" }),
    );
    expect((noVo.brief_hints as { suggested_vo_file: string }).suggested_vo_file).toBe("vo/VO_full.mp3");
    expect(noVo.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/voice_over/)]));
  });

  it("refuses organization_id and empty shots", () => {
    expect(renderJobDraftInput.safeParse({ ...draftArgs, organization_id: "o2" }).success).toBe(false);
    expect(renderJobDraftInput.safeParse({ ...draftArgs, shots: [] }).success).toBe(false);
  });
});

const draftArgs = {
  title: "Gaya anim",
  production: "379e87fc Sate Kambing",
  output_name: "379e87fc_Sate_Kambing_VO_v2_9x16",
  shots: [{ file_key: "PIK1/sate kambing/a.mp4", in: 0, out: 12 }],
  vo_file: "vo/VO_full.mp3",
};

describe("draft follows the Gaya baku teks animations (Sate Sultan PIK box, 24 Nov 2026)", () => {
  const teks = [
    "- Hook: teks besar kuning #FFD640 + putih, garis tepi hitam, muncul pop per baris dengan getar kecil. Tampil dari detik 0.",
    "- Subtitle: Poppins Bold putih dengan garis tepi hitam, kata yang lagi diucapkan jadi kuning #FFD640 dan sedikit membesar.",
    "- Label nama menu: tulisan putih di kotak maroon #7A181E, letaknya di bawah makanan.",
    "- Label info maroon (#7A181E, tulisan putih, masuk dengan slide): khusus fakta singkat.",
  ].join("\n");

  it("lights the spoken word, shakes the hook, and draws menu and info labels in maroon", () => {
    const { spec } = buildDraftSpec(
      renderJobDraftInput.parse({
        ...draftArgs,
        texts: [
          { text: "SATE KAMBING TANPA BAU PRENGUS", start: 0, end: 1.2, style: "hook" },
          { text: "Ternyata isinya full daging,", start: 1.3, end: 2.5, style: "sub" },
          { text: "Sate Kambing Full Daging", start: 2.6, end: 3.5, style: "menu" },
          { text: "Best seller", start: 2.6, end: 3.5, style: "info" },
        ],
      }),
      { teks },
    );
    expect(spec.texts.map((t) => t.anim)).toEqual(["pop_shake", "highlight", "menu_label", "slide"]);
    expect(spec.styles.sub?.highlight).toBe("#FFD640");
    expect(spec.styles.menu).toMatchObject({ bg: "#7A181E", color: "#FFFFFF", size: 10, y: -0.5 });
    expect(spec.styles.info).toMatchObject({ bg: "#7A181E", color: "#FFFFFF" });
  });

  it("keeps plain pop and the reference menu look when Gaya baku says nothing about them", () => {
    const { spec } = buildDraftSpec(
      renderJobDraftInput.parse({ ...draftArgs, texts: [{ text: "x y", start: 0, end: 1, style: "sub" }, { text: "Menu", start: 1, end: 2, style: "menu" }] }),
      { teks: "- Hook: kuning" },
    );
    expect(spec.texts[0]!.anim).toBe("pop");
    expect(spec.styles.sub?.highlight).toBeUndefined();
    expect(spec.styles.menu).toMatchObject({ bg: "#F6E27A", font: "instrument-serif" });
  });

  it("never gives another organization the Sate Sultan maroon when its Gaya baku has no label colour", () => {
    const { spec } = buildDraftSpec(
      renderJobDraftInput.parse({ ...draftArgs, texts: [{ text: "Best seller", start: 0, end: 1, style: "info" }] }),
      { teks: "- Hook: putih besar" },
    );
    expect(spec.styles.info).toMatchObject({ bg: "#222222", bg_alpha: 0.85 });
    expect(JSON.stringify(spec.styles)).not.toContain("7A181E");
  });

  it("passes VO word timings through to the spec", () => {
    const words = [
      { text: "nggak", start: 10.1, end: 10.4 },
      { text: "alot", start: 10.5, end: 10.9 },
    ];
    const { spec } = buildDraftSpec(
      renderJobDraftInput.parse({ ...draftArgs, texts: [{ text: "nggak alot", start: 10, end: 11, style: "sub", words }] }),
      { teks },
    );
    expect(spec.texts[0]).toMatchObject({ anim: "highlight", words });
  });
});
