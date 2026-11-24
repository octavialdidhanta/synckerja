/**
 * Read-only helper: turn shots (+ optional VO/music/texts) into a ready renderSpecV1
 * so Claude does not hand-write the full JSON. Styles come from Gaya baku defaults;
 * Claude can tweak then call render.jobs.create.preview.
 */
import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CatalogTextBlocks } from "../../db/catalog";
import { renderSpecV1, specDuration, type RenderSpecV1 } from "./renderSpec";
import { checkSpec, footageFindings, referenceFindings } from "./specChecks";

const shotIn = z
  .object({
    file_key: z.string().trim().min(1).max(2000),
    in: z.number().finite().min(0).max(3600),
    out: z.number().finite().min(0).max(3600),
    label: z.string().trim().max(80).optional(),
  })
  .strict()
  .refine((s) => s.out - s.in >= 1 / 30, { message: "a shot needs at least one frame" });

const textIn = z
  .object({
    text: z.string().min(1).max(300),
    start: z.number().finite().min(0).max(3600),
    end: z.number().finite().min(0).max(3600),
    style: z.enum(["hook", "sub", "menu", "info"]).optional(),
    anim: z.enum(["none", "fade", "pop", "typewriter", "highlight", "pop_shake", "slide"]).optional(),
    /** VO word timings for a highlighted subtitle, in seconds on the final video. */
    words: z
      .array(z.object({ text: z.string().min(1).max(60), start: z.number().min(0).max(3600), end: z.number().min(0).max(3600) }).strict())
      .max(60)
      .optional(),
    behind_person: z.boolean().optional(),
  })
  .strict()
  .refine((t) => t.end > t.start);

const relAudio = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((p) => !p.startsWith("/") && !p.startsWith("\\") && !/^[A-Za-z]:/.test(p) && !/(^|[\\/])\.\.([\\/]|$)/.test(p), {
    message: "path must stay inside the production folder",
  });

export const renderJobDraftInput = z
  .object({
    plan_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    production: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((p) => !/[\\/]/.test(p) && p !== "." && p !== "..", { message: "one folder name, no slashes" }),
    output_name: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9 _.()-]+$/),
    shots: z.array(shotIn).min(1).max(80),
    vo_file: relAudio.optional(),
    music_file: relAudio.optional(),
    texts: z.array(textIn).max(40).optional(),
    /** End card. "halftone" plays the locked 1s print-dot closer. */
    outro: z.enum(["halftone"]).optional(),
    /** Production-folder image used as the halftone emblem, for example brand/emblem.png. */
    logo_file: relAudio.optional(),
    /** Ids of the catalog reference videos this edit borrows structure or motion from (catalog.reference.get). */
    references: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
    /** Why no reference fits this edit, when references is empty. */
    no_reference_reason: z.string().trim().min(5).max(300).optional(),
  })
  .strict();

export type RenderJobDraftInput = z.infer<typeof renderJobDraftInput>;

export type BriefDraftHint = {
  title: string | null;
  caption: string | null;
  voice_over: string | null;
  suggested_vo_file: string | null;
};

const HEX = /#([0-9a-fA-F]{6})\b/g;
const BRAND_SKIP = new Set(["#7A181E", "#F7F3EA"]);

export function extractHexColors(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(HEX)) {
    const hex = `#${m[1]!.toUpperCase()}`;
    if (!out.includes(hex)) out.push(hex);
  }
  return out;
}

/** CapCut-like defaults; refine from Gaya baku teks (hex + posisi aman) when present. */
export function defaultRenderStyles(gaya: CatalogTextBlocks): RenderSpecV1["styles"] {
  const teks = gaya.teks ?? "";
  const hexes = extractHexColors(teks);
  const hookYellow = hexes.find((h) => h === "#FFD640");
  const hookColor = hookYellow ?? hexes.find((h) => !BRAND_SKIP.has(h) && h !== "#FFFFFF") ?? "#FFFFFF";
  const subColor = /subtitle|Poppins/i.test(teks) ? "#FFFFFF" : "#FFFFFF";
  const stroke = hexes.includes("#000000") || /garis tepi hitam/i.test(teks) ? "#000000" : "#000000";
  const font: "poppins" | "instrument-serif" = /Instrument Serif/i.test(teks) ? "instrument-serif" : "poppins";
  // Safe area: 14% top → CapCut y ≈ 0.72; 20% bottom → y ≈ -0.6 (AgentReel: y up).
  const hookY = /14%\s*atas/i.test(teks) ? 0.72 : 0.32;
  const subY = /20%\s*bawah/i.test(teks) ? -0.6 : -0.54;

  return {
    hook: {
      size: 11,
      color: hookColor,
      stroke,
      stroke_width: 0.14,
      bold: true,
      font,
      y: hookY,
      max_width: 0.88,
    },
    sub: {
      size: 9,
      color: subColor,
      stroke,
      stroke_width: 0.12,
      bold: true,
      font: "poppins",
      y: subY,
      max_width: 0.9,
    },
  };
}

/** The Gaya baku teks line that starts with a label (for example "Label nama menu"), or "". */
function gayaLine(teks: string, label: RegExp): string {
  return teks.split(/\r?\n/).find((l) => label.test(l)) ?? "";
}

/**
 * What the Gaya baku teks box asks the Agent to animate: the spoken word lit in the subtitle ("kata yang lagi
 * diucapkan ... kuning") and a small shake on the hook ("getar").
 */
export function gayaAnimations(gaya: CatalogTextBlocks): { hook: "pop" | "pop_shake"; sub: "pop" | "highlight"; highlight: string | null } {
  const teks = gaya.teks ?? "";
  const subLine = gayaLine(teks, /subtitle/i);
  const spoken = /(diucapkan|diucapin|diomongin|spoken)/i.test(subLine);
  const lit = extractHexColors(subLine).find((h) => h !== "#FFFFFF" && h !== "#000000") ?? null;
  return {
    hook: /getar|shake/i.test(gayaLine(teks, /hook/i)) ? "pop_shake" : "pop",
    sub: spoken ? "highlight" : "pop",
    highlight: spoken ? (lit ?? "#FFD640") : null,
  };
}

/** Info label (berat porsi, lama masak, best seller): the Gaya baku "Label info" box colour (else neutral dark), white text, slides in. */
export function infoLabelStyle(gaya: CatalogTextBlocks): RenderSpecV1["styles"][string] {
  const line = gayaLine(gaya.teks ?? "", /label info/i);
  // No colour in this organization's Gaya baku: a neutral dark box, never another brand's colour.
  const bg = extractHexColors(line).find((h) => h !== "#FFFFFF");
  return { size: 8, color: "#FFFFFF", bg: bg ?? "#222222", bg_alpha: bg ? 1 : 0.85, bold: true, font: "poppins", y: 0.5, max_width: 0.8 };
}

/**
 * Menu label under the food (see specChecks MENU_SAFE_Y). When Gaya baku teks has a "Label nama menu" line with a
 * box colour, that look is used (white bold on the colour); otherwise the reference look (pale yellow, black serif).
 */
export function menuLabelStyle(gaya: CatalogTextBlocks = {}): RenderSpecV1["styles"][string] {
  const line = gayaLine(gaya.teks ?? "", /label nama menu/i);
  const box = extractHexColors(line).find((h) => h !== "#FFFFFF");
  if (box) {
    return { size: 10, color: "#FFFFFF", bg: box, bg_alpha: 1, bold: true, font: "poppins", x: -0.42, y: -0.5, max_width: 0.72 };
  }
  return {
    size: 10,
    color: "#1A1A1A",
    bg: "#F6E27A",
    bg_alpha: 1,
    bold: false,
    font: "instrument-serif",
    x: -0.42,
    y: -0.5,
    max_width: 0.72,
  };
}

/** Music bed under VO; parse first "N dB" from Gaya musik (Agent also ducks + loudnorm -14). */
export function defaultMusicDb(gaya: CatalogTextBlocks): number {
  const m = /(-?\d+(?:\.\d+)?)\s*dB/i.exec(gaya.musik ?? "");
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= -60 && n <= 12) return n;
  }
  return -18;
}

export function buildDraftSpec(
  input: RenderJobDraftInput,
  gaya: CatalogTextBlocks,
): { spec: RenderSpecV1; warnings: string[] } {
  const warnings: string[] = [];
  const styles = defaultRenderStyles(gaya);
  if (gaya.teks?.trim()) {
    warnings.push(`Gaya teks diterapkan ke styles (hook ${styles.hook?.color}, sub y=${styles.sub?.y}).`);
  } else {
    warnings.push("Gaya baku blok 'teks' kosong; memakai style CapCut default.");
  }
  const wantsMenu = (input.texts ?? []).some((t) => t.style === "menu");
  if (wantsMenu) styles.menu = menuLabelStyle(gaya);
  if ((input.texts ?? []).some((t) => t.style === "info")) styles.info = infoLabelStyle(gaya);
  const anims = gayaAnimations(gaya);
  if (anims.highlight && styles.sub) styles.sub.highlight = anims.highlight;
  const defaultAnim = (style: string) =>
    style === "hook" ? anims.hook : style === "sub" ? anims.sub : style === "info" ? ("slide" as const) : ("pop" as const);
  const texts = (input.texts ?? []).map((t) => {
    const style = (t.style ?? "sub") as string;
    const menu = style === "menu";
    if (menu && t.anim) warnings.push('style "menu" mengunci animasi menu_label; anim yang dikirim diabaikan.');
    return {
      text: t.text,
      start: t.start,
      end: t.end,
      style,
      anim: menu ? ("menu_label" as const) : (t.anim ?? defaultAnim(style)),
      ...(t.words?.length ? { words: t.words } : {}),
      ...(t.behind_person ? { behind_person: true as const } : {}),
    };
  });
  if (anims.sub === "highlight" || anims.hook === "pop_shake") {
    warnings.push(
      `Animasi dari Gaya teks: hook ${anims.hook}, subtitle ${anims.sub}${anims.highlight ? ` (${anims.highlight})` : ""}. Butuh Agent v0.1.10 atau lebih baru.`,
    );
  }
  for (const t of texts) {
    if (!(t.style in styles)) {
      warnings.push(`style "${t.style}" tidak ada di draft; diganti "sub"`);
      t.style = "sub";
    }
  }
  let outro: RenderSpecV1["outro"];
  if (input.outro === "halftone") {
    outro = { kind: "halftone", seconds: 1, ...(input.logo_file ? { logo: input.logo_file } : {}) };
    if (!input.logo_file) warnings.push("outro halftone tanpa logo_file; penutup memudar ke putih tanpa emblem.");
  } else if (input.logo_file) {
    warnings.push("logo_file diabaikan karena outro bukan halftone.");
  }
  const musicDb = defaultMusicDb(gaya);
  const audio: RenderSpecV1["audio"] = {};
  if (input.vo_file) audio.vo = { file: input.vo_file, at: 0, db: 0 };
  if (input.music_file) {
    audio.music = {
      file: input.music_file,
      at: 0,
      in: 0,
      db: musicDb,
      fade_in: 0.3,
      fade_out: 1,
    };
  }
  if (!input.vo_file && !input.music_file) {
    warnings.push(
      "Tidak ada VO/musik di draft. Tambahkan vo_file / music_file (path di folder produksi) sebelum preview, atau edit spec.",
    );
  }
  if (!gaya.musik?.trim()) warnings.push("Gaya baku blok 'musik' kosong; musik default -18 dB.");
  else if (musicDb !== -18) warnings.push(`Gaya musik: memakai ${musicDb} dB untuk bed.`);

  const raw = {
    version: 1 as const,
    production: input.production,
    output_name: input.output_name,
    shots: input.shots.map((s) => ({
      file_key: s.file_key,
      in: s.in,
      out: s.out,
      ...(s.label ? { label: s.label } : {}),
    })),
    audio,
    styles,
    texts,
    ...(outro ? { outro } : {}),
  };
  const parsed = renderSpecV1.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  return { spec: parsed.data, warnings };
}

export type FootageKeyInfo = { duration_seconds: number | null };

export type BriefLookup = (ctx: McpAuthContext, planId: string) => Promise<{
  title: string | null;
  caption: string | null;
  voice_over: string | null;
} | null>;

export async function draftRenderJobResult(
  ctx: McpAuthContext,
  args: unknown,
  getStyle: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
  lookupFootage?: (ctx: McpAuthContext, fileKey: string) => Promise<FootageKeyInfo | null>,
  getBrief?: BriefLookup,
  listReferences?: (ctx: McpAuthContext) => Promise<Array<{ id: string; title: string | null }>>,
): Promise<Record<string, unknown>> {
  const parsed = renderJobDraftInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const input = parsed.data;
  const gaya = await getStyle(ctx);
  const { spec, warnings } = buildDraftSpec(input, gaya);

  const footageErrors = lookupFootage ? await footageFindings(spec, (k) => lookupFootage(ctx, k)) : [];

  let brief_hints: BriefDraftHint | null = null;
  if (input.plan_id && getBrief) {
    try {
      const brief = await getBrief(ctx, input.plan_id);
      if (brief) {
        const hasVoText = Boolean(brief.voice_over?.trim());
        brief_hints = {
          title: brief.title,
          caption: brief.caption,
          voice_over: brief.voice_over,
          suggested_vo_file: hasVoText && !input.vo_file ? "vo/VO_full.mp3" : null,
        };
        if (hasVoText && !input.vo_file) {
          warnings.push(
            "Brief punya voice_over; isi vo_file (mis. vo/VO_full.mp3 dari content.briefs.voice) sebelum preview, atau unduh VO dulu.",
          );
        }
        if (brief.caption?.trim() && (input.texts?.length ?? 0) === 0) {
          warnings.push("Brief punya caption; bisa dijadikan teks on-screen di texts[] (style hook/sub) sebelum preview.");
        }
      }
    } catch {
      warnings.push(`plan_id tidak bisa dibaca sebagai brief: ${input.plan_id}`);
    }
  }

  const checks = checkSpec(spec, gaya, [], footageErrors);
  if (listReferences) {
    let available: Array<{ id: string; title: string | null }> = [];
    try {
      available = await listReferences(ctx);
    } catch {
      available = [];
    }
    checks.suggestions.push(...referenceFindings(gaya, input, available));
  }

  return {
    title: input.title,
    plan_id: input.plan_id ?? null,
    references: input.references ?? [],
    spec,
    checks,
    summary: {
      production: spec.production,
      output_name: spec.output_name,
      duration_seconds: Math.round(specDuration(spec) * 100) / 100,
      shots: spec.shots.length,
      texts: spec.texts.length,
      vo: spec.audio.vo?.file ?? null,
      music: spec.audio.music?.file ?? null,
      music_db: spec.audio.music?.db ?? null,
      style_keys: Object.keys(spec.styles),
      hook_color: spec.styles.hook?.color ?? null,
    },
    brief_hints,
    warnings,
    next_step:
      "Fix every item in checks.errors and checks.required (or keep a required one only with overrides [{code, reason}] in render.jobs.create.preview); mention checks.suggestions to the user if you keep them. Review the draft spec (edit shots/texts/audio if needed). Then call render.jobs.create.preview with the same title, plan_id, and this spec. After the user clearly says yes, call render.jobs.create with that confirm_token. Music defaults follow Gaya musik (usually -18 dB under VO); the Agent applies sidechain ducking and loudnorm -14 LUFS. texts[].style=menu draws the yellow typewriter menu label. outro=halftone adds the 1s dotted closer (optional logo_file inside the production folder). behind_person=true places that text under the person (Agent SAM2+RVM). A top-level effects array is still refused.",
  };
}
