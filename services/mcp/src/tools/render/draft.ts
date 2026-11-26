/**
 * Read-only helper: turn shots (+ optional VO/music/texts) into a ready renderSpecV1
 * so Claude does not hand-write the full JSON. Styles come from Gaya baku defaults;
 * Claude can tweak then call render.jobs.create.preview.
 */
import { z } from "zod";
import { isNoVoMarker, timingSeconds } from "../content/voMarker";
import { CTA_AGENT_VERSION, ctaStyles, ctaTexts, ctaWaInput } from "./ctaWa";
import type { McpAuthContext } from "../../authz/context";
import type { CatalogTextBlocks } from "../../db/catalog";
import { renderSpecV1, specDuration, type RenderSpecV1 } from "./renderSpec";
import { checkSpec, footageFindings, referenceFindings } from "./specChecks";
import { autoShots } from "./autoShots";
import { buildVoTimeline, type VoRowIn, type VoWord } from "./voTimeline";

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
    style: z.enum(["hook", "sub", "menu", "info", "judul"]).optional(),
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

/** Clips for one VO row: the draft shares the row's time between them and keeps each cut inside one scene. */
const rowShotsIn = z
  .array(
    z
      .object({
        file_key: z.string().trim().min(1).max(2000),
        /** Where in the source to start (seconds); picks the scene. Default the clip start. */
        in: z.number().min(0).max(3600).optional(),
        label: z.string().trim().max(80).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(6)
  .optional();

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
    shots: z.array(shotIn).min(1).max(80).optional(),
    vo_file: relAudio.optional(),
    /**
     * VO per storyboard row, in order (needs plan_id): each row's newest clip is placed after the previous one,
     * and subtitles are cut from its word timings. silence rows keep a pause with no VO (for example a tasting shot).
     */
    vo_rows: z
      .array(
        z.union([
          z.object({ row_index: z.number().int().min(0).max(59), file: relAudio.optional(), gap_after: z.number().min(0).max(3).optional(), shots: rowShotsIn }).strict(),
          z.object({ silence: z.number().min(0.1).max(30), row_index: z.number().int().min(0).max(59).optional(), shots: rowShotsIn }).strict(),
        ]),
      )
      .min(1)
      .max(60)
      .optional(),
    vo_gap: z.number().min(0).max(2).optional(),
    vo_start: z.number().min(0).max(10).optional(),
    music_file: relAudio.optional(),
    texts: z.array(textIn).max(40).optional(),
    /** End card. "halftone" plays the locked 1s print-dot closer. */
    outro: z.enum(["halftone"]).optional(),
    /**
     * Click-to-WhatsApp ad closer: chat button (pops, then pulses), optional location label rising from below and
     * brand name, styled from Gaya baku. Default timing: the last voice over row. Needs Agent 0.1.23+.
     */
    cta_wa: z.lazy(() => ctaWaInput).optional(),
    /** Still preview: seconds on the final video to render as one contact sheet instead of the whole video (max 12). */
    stills: z.array(z.number().finite().min(0).max(3600)).min(1).max(12).optional(),
    /** Production-folder image used as the halftone emblem, for example brand/emblem.png. */
    logo_file: relAudio.optional(),
    /** Ids of the catalog reference videos this edit borrows structure or motion from (catalog.reference.get). */
    references: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
    /** Why no reference fits this edit, when references is empty. */
    no_reference_reason: z.string().trim().min(5).max(300).optional(),
  })
  .strict()
  .refine((v) => v.shots !== undefined || (v.vo_rows ?? []).some((r) => r.shots?.length), {
    message: "give shots, or shots per row inside vo_rows",
  })
  .refine((v) => !(v.shots && (v.vo_rows ?? []).some((r) => r.shots?.length)), {
    message: "use shots or vo_rows[].shots, not both",
  });

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

/** Relative luminance 0..1 of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Font size written on a Gaya baku line: "(±17)", "ukuran minimal 15", "ukuran 12". */
export function gayaSize(line: string): number | null {
  const m = /(?:ukuran(?:\s+(?:besar|minimal|min\.?))?\s*\(?\s*±?|±)\s*(\d{1,2})\b/i.exec(line);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 4 && n <= 40 ? n : null;
}

/** The standard subtitle line of Gaya baku teks: the first "Subtitle" line that is not marked as a variant. */
function subtitleLine(teks: string): string {
  const lines = teks.split(/\r?\n/).filter((l) => /^\s*-?\s*subtitle/i.test(l));
  return lines.find((l) => !/varian/i.test(l)) ?? lines[0] ?? "";
}

/** CapCut-like defaults; refine from Gaya baku teks (per-element lines: hex, font, size, posisi aman) when present. */
export function defaultRenderStyles(gaya: CatalogTextBlocks): RenderSpecV1["styles"] {
  const teks = gaya.teks ?? "";
  const hexes = extractHexColors(teks);
  const hookLine = gayaLine(teks, /^\s*-?\s*hook/i);
  const hookHexes = extractHexColors(hookLine);
  const hookYellow = [...hookHexes, ...hexes].find((h) => h === "#FFD640");
  const hookColor = hookYellow ?? hookHexes.find((h) => !BRAND_SKIP.has(h) && h !== "#FFFFFF") ?? hexes.find((h) => !BRAND_SKIP.has(h) && h !== "#FFFFFF") ?? "#FFFFFF";
  const hookFont: "poppins" | "instrument-serif" = /Instrument Serif/i.test(hookLine) && !/Poppins/i.test(hookLine)
    ? "instrument-serif"
    : hookLine
      ? "poppins"
      : /Instrument Serif/i.test(teks) ? "instrument-serif" : "poppins";
  const subLine = subtitleLine(teks);
  const subHexes = extractHexColors(subLine).filter((h) => h !== "#FFD640");
  const subColor = subHexes.find((h) => luminance(h) > 0.6) ?? "#FFFFFF";
  const subStroke = subHexes.find((h) => luminance(h) < 0.3) ?? "#000000";
  // Safe area: 14% top → CapCut y ≈ 0.72; 20% bottom → y ≈ -0.6 (AgentReel: y up).
  const hookY = /14%\s*atas/i.test(teks) ? 0.72 : 0.32;
  const subY = /20%\s*bawah/i.test(teks) ? -0.6 : -0.54;

  return {
    hook: {
      size: gayaSize(hookLine) ?? 11,
      color: hookColor,
      stroke: "#000000",
      stroke_width: 0.14,
      bold: true,
      font: hookFont,
      y: hookY,
      max_width: 0.88,
    },
    sub: {
      size: gayaSize(subLine) ?? 9,
      color: subColor,
      stroke: subStroke,
      stroke_width: subStroke === "#000000" ? 0.12 : 0.16,
      bold: true,
      font: "poppins",
      y: subY,
      max_width: 0.9,
    },
  };
}

/**
 * Title / step label ("Judul / langkah" line, e.g. Rocky's yellow typed box): box colour = light hex, text = dark hex,
 * Instrument Serif when the line says so, size from "ukuran minimal N". Typed in with the growing box (menu_label).
 */
export function judulLabelStyle(gaya: CatalogTextBlocks): RenderSpecV1["styles"][string] {
  const line = gayaLine(gaya.teks ?? "", /^\s*-?\s*judul/i);
  const hx = extractHexColors(line);
  const bg = hx.find((h) => luminance(h) > 0.6) ?? "#FAFD96";
  const color = hx.find((h) => luminance(h) < 0.3) ?? "#111111";
  const serif = !line || /Instrument Serif/i.test(line);
  return {
    size: gayaSize(line) ?? 15,
    color,
    bg,
    bg_alpha: 1,
    bold: !serif,
    font: serif ? "instrument-serif" : "poppins",
    x: -0.42,
    y: 0.62,
    max_width: 0.8,
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
export function gayaAnimations(gaya: CatalogTextBlocks): {
  hook: "pop" | "pop_shake";
  sub: "pop" | "highlight" | "none";
  highlight: string | null;
} {
  const teks = gaya.teks ?? "";
  const subLine = subtitleLine(teks);
  const spoken = /(diucapkan|diucapin|diomongin|spoken)/i.test(subLine);
  const cut = /tanpa animasi|langsung ganti/i.test(subLine);
  const lit = extractHexColors(subLine).find((h) => h !== "#FFFFFF" && h !== "#000000") ?? null;
  return {
    hook: /getar|shake/i.test(gayaLine(teks, /^\s*-?\s*hook/i)) ? "pop_shake" : "pop",
    sub: spoken ? "highlight" : cut ? "none" : "pop",
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
  if ((input.texts ?? []).some((t) => t.style === "judul")) styles.judul = judulLabelStyle(gaya);
  const anims = gayaAnimations(gaya);
  if (anims.highlight && styles.sub) styles.sub.highlight = anims.highlight;
  const defaultAnim = (style: string) =>
    style === "hook" ? anims.hook : style === "sub" ? anims.sub : style === "info" ? ("slide" as const) : ("pop" as const);
  const texts = (input.texts ?? []).map((t) => {
    const style = (t.style ?? "sub") as string;
    const menu = style === "menu" || style === "judul";
    if (menu && t.anim) warnings.push(`style "${style}" mengunci animasi menu_label; anim yang dikirim diabaikan.`);
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
    shots: (input.shots ?? []).map((s) => ({
      file_key: s.file_key,
      in: s.in,
      out: s.out,
      ...(s.label ? { label: s.label } : {}),
    })),
    audio,
    styles,
    texts,
    ...(outro ? { outro } : {}),
    ...(input.stills ? { stills: input.stills } : {}),
  };
  const parsed = renderSpecV1.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  return { spec: parsed.data, warnings };
}

export type FootageKeyInfo = { duration_seconds: number | null; scene_starts?: number[] };

export type BriefLookup = (ctx: McpAuthContext, planId: string) => Promise<{
  title: string | null;
  caption: string | null;
  voice_over: string | null;
  /** Storyboard rows in order (vo cell and timing), used to turn "(suara asli)" rows into silence. */
  rows?: Array<{ vo: string | null; timing: string | null }>;
} | null>;

/** Pause used for a no-VO row whose storyboard timing is not a readable range. */
const NO_VO_ROW_SECONDS = 1.5;

/** Newest VO clip of one storyboard row: null when the row has no clip. */
export type VoRowLookup = (
  ctx: McpAuthContext,
  planId: string,
  rowIndex: number,
) => Promise<{ duration_seconds: number | null; words: VoWord[] | null; file_name: string } | null>;

async function resolveVoRows(
  ctx: McpAuthContext,
  input: RenderJobDraftInput,
  lookupVoice: VoRowLookup,
  briefRows: Array<{ vo: string | null; timing: string | null }> | null,
  warnings: string[],
): Promise<VoRowIn[]> {
  if (!input.plan_id) throw new Error("invalid_input: vo_rows needs plan_id (the content plan whose VO clips are used)");
  const out: VoRowIn[] = [];
  for (const r of input.vo_rows ?? []) {
    if ("silence" in r) {
      out.push({ kind: "silence", row_index: r.row_index ?? null, seconds: r.silence });
      continue;
    }
    const cell = briefRows?.[r.row_index];
    if (cell && !r.file && isNoVoMarker(cell.vo)) {
      // "(suara asli)", "-", empty: a pause, never a clip (a clip made by mistake would read the marker aloud).
      const seconds = timingSeconds(cell.timing) ?? NO_VO_ROW_SECONDS;
      out.push({ kind: "silence", row_index: r.row_index, seconds });
      warnings.push(
        `baris ${r.row_index}: vo "${(cell.vo ?? "").trim().slice(0, 40) || "(kosong)"}" tanpa VO, dijadikan jeda ${seconds} s tanpa klip (shot tetap dipakai). Pakai {silence, row_index} untuk durasi lain.`,
      );
      continue;
    }
    const clip = await lookupVoice(ctx, input.plan_id, r.row_index);
    if (!clip) throw new Error(`invalid_input: storyboard row ${r.row_index} (row_index, 0-based) has no VO clip yet; generate it with content.briefs.voice.generate`);
    const lastWord = clip.words?.length ? clip.words[clip.words.length - 1]!.end + 0.05 : 0;
    const duration = Math.max(clip.duration_seconds ?? 0, lastWord);
    if (!(duration > 0)) throw new Error(`invalid_input: VO clip of row ${r.row_index} has no readable duration`);
    out.push({
      kind: "clip",
      row_index: r.row_index,
      file: r.file ?? `vo/${clip.file_name || `vo-${r.row_index + 1}.mp3`}`,
      duration,
      words: clip.words,
      ...(r.gap_after != null ? { gap_after: r.gap_after } : {}),
    });
  }
  return out;
}

export async function draftRenderJobResult(
  ctx: McpAuthContext,
  args: unknown,
  getStyle: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
  lookupFootage?: (ctx: McpAuthContext, fileKey: string) => Promise<FootageKeyInfo | null>,
  getBrief?: BriefLookup,
  listReferences?: (ctx: McpAuthContext) => Promise<Array<{ id: string; title: string | null }>>,
  lookupVoice?: VoRowLookup,
  saveDraft?: (ctx: McpAuthContext, input: { title: string; plan_id: string | null; spec: unknown }) => Promise<{ draft_id: string; expires_at: string }>,
): Promise<Record<string, unknown>> {
  const parsed = renderJobDraftInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  let input = parsed.data;
  if (input.vo_rows && input.vo_file) throw new Error("invalid_input: use vo_file or vo_rows, not both");
  let voTimeline: ReturnType<typeof buildVoTimeline> | null = null;
  const rowWarnings: string[] = [];
  if (input.vo_rows) {
    if (!lookupVoice) throw new Error("invalid_input: vo_rows is not available here");
    let briefRows: Array<{ vo: string | null; timing: string | null }> | null = null;
    if (input.plan_id && getBrief) {
      try {
        briefRows = (await getBrief(ctx, input.plan_id))?.rows ?? null;
      } catch {
        briefRows = null;
      }
    }
    voTimeline = buildVoTimeline(await resolveVoRows(ctx, input, lookupVoice, briefRows, rowWarnings), {
      gap: input.vo_gap,
      start: input.vo_start,
    });
    // Subtitles from the VO words, unless the caller already wrote its own subtitle texts.
    if (!(input.texts ?? []).some((t) => (t.style ?? "sub") === "sub")) {
      input = {
        ...input,
        texts: [
          ...(input.texts ?? []),
          ...voTimeline.subtitles.map((s) => ({ text: s.text, start: s.start, end: s.end, style: "sub" as const, words: s.words })),
        ],
      };
    }
  }
  const autoWarnings: string[] = [...rowWarnings];
  if (voTimeline && (input.vo_rows ?? []).some((r) => r.shots?.length)) {
    // Shots from the rows: one draft, cut on the VO, every cut inside one catalog scene.
    const keys = [...new Set((input.vo_rows ?? []).flatMap((r) => (r.shots ?? []).map((c) => c.file_key)))];
    const lookup = new Map<string, FootageKeyInfo | null>();
    for (const k of keys) lookup.set(k, lookupFootage ? await lookupFootage(ctx, k) : null);
    const missing = keys.filter((k) => lookupFootage && !lookup.get(k));
    if (missing.length) throw new Error(`invalid_input: footage not found: ${missing.slice(0, 5).join(", ")}`);
    const auto = autoShots(voTimeline.timeline, (input.vo_rows ?? []).map((r) => r.shots), lookup);
    if (!auto.shots.length) throw new Error("invalid_input: vo_rows[].shots made no shots");
    input = { ...input, shots: auto.shots };
    autoWarnings.push(...auto.warnings);
  }
  const gaya = await getStyle(ctx);
  const built = buildDraftSpec(input, gaya);
  const spec = built.spec;
  let warnings = [...built.warnings, ...autoWarnings];
  if (voTimeline) {
    spec.audio.vo_parts = voTimeline.parts.map((p) => ({ file: p.file, at: p.at, db: 0 }));
    warnings = warnings.filter((w) => !w.startsWith("Tidak ada VO/musik"));
    const dur = specDuration(spec);
    if (voTimeline.end > dur + 0.01) {
      warnings.push(
        `VO berakhir di ${voTimeline.end.toFixed(2)} s tapi shot cuma ${dur.toFixed(2)} s: tambah/panjangkan shot (pakai vo_timeline untuk memotong shot per baris).`,
      );
    }
    warnings.push(`VO per baris (vo_parts, ${voTimeline.parts.length} klip) butuh Agent v0.1.15 atau lebih baru. Agent v0.1.22+ mengunduh sendiri klip terbaru tiap baris ke folder vo saat render (butuh plan_id); Agent lebih lama: unduh tiap klip ke file di vo_parts dulu.`);
  }

  if (input.cta_wa) {
    // Closer window: given, else the last voice over row, else the last 3 s; always before the halftone closer.
    const dur = specDuration(spec);
    const closerAt = spec.outro ? dur - (spec.outro.seconds ?? 1) : dur;
    const lastRow = voTimeline?.timeline.filter((r) => r.file).at(-1);
    let end = Math.min(input.cta_wa.end ?? (lastRow ? lastRow.end : closerAt), closerAt);
    let start = input.cta_wa.start ?? (lastRow ? lastRow.start : end - 3);
    start = Math.max(0, Math.min(start, end - 1));
    end = Math.max(end, start + 1);
    const styles = ctaStyles(gaya);
    spec.styles = { ...spec.styles, ...styles };
    spec.texts = [...spec.texts, ...ctaTexts(input.cta_wa, Math.round(start * 100) / 100, Math.round(end * 100) / 100)];
    warnings.push(
      `Penutup CTWA (cta_wa) ${start.toFixed(2)}–${end.toFixed(2)} s: tombol ${styles.cta_wa.bg}${input.cta_wa.location_text ? ", label lokasi" : ""}${input.cta_wa.brand_text ? ", nama brand" : ""}. Butuh Agent v${CTA_AGENT_VERSION} atau lebih baru; cek di still preview.`,
    );
  }

  const footageErrors = lookupFootage ? await footageFindings(spec, (k) => lookupFootage(ctx, k)) : [];

  let brief_hints: BriefDraftHint | null = null;
  if (input.plan_id && getBrief) {
    try {
      const brief = await getBrief(ctx, input.plan_id);
      if (brief) {
        const hasVoText = Boolean(brief.voice_over?.trim()) && !input.vo_rows;
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

  let draft_id: string | null = null;
  if (saveDraft) {
    try {
      draft_id = (await saveDraft(ctx, { title: input.title, plan_id: input.plan_id ?? null, spec })).draft_id;
    } catch {
      warnings.push("Draft tidak tersimpan di server; kirim spec lengkap ke render.stills.create / render.jobs.create.preview.");
    }
  }

  return {
    title: input.title,
    plan_id: input.plan_id ?? null,
    ...(draft_id ? { draft_id } : {}),
    references: input.references ?? [],
    spec,
    checks,
    summary: {
      production: spec.production,
      output_name: spec.output_name,
      duration_seconds: Math.round(specDuration(spec) * 100) / 100,
      shots: spec.shots.length,
      texts: spec.texts.length,
      vo: spec.audio.vo?.file ?? (spec.audio.vo_parts ? `${spec.audio.vo_parts.length} klip (vo_parts)` : null),
      music: spec.audio.music?.file ?? null,
      music_db: spec.audio.music?.db ?? null,
      style_keys: Object.keys(spec.styles),
      hook_color: spec.styles.hook?.color ?? null,
    },
    brief_hints,
    ...(voTimeline ? { vo_timeline: voTimeline.timeline, vo_end_seconds: voTimeline.end } : {}),
    warnings,
    next_step:
      "Fix every item in checks.errors and checks.required (or keep a required one only with overrides [{code, reason}] in render.jobs.create.preview); mention checks.suggestions to the user if you keep them. Review the draft spec (edit shots/texts/audio if needed). Then call render.stills.create and render.jobs.create.preview with draft_id (plus a patch of only the keys you changed: shots, texts, styles per name, audio, outro, stills) instead of resending the spec; without draft_id use the same title, plan_id and this spec. After the user clearly says yes, call render.jobs.create with that confirm_token. Music defaults follow Gaya musik (usually -18 dB under VO); the Agent applies sidechain ducking and loudnorm -14 LUFS. texts[].style=menu draws the yellow typewriter menu label. cta_wa adds the click-to-WhatsApp closer (Agent 0.1.23+). outro=halftone adds the 1s dotted closer (optional logo_file inside the production folder). behind_person=true places that text under the person (Agent SAM2+RVM). A top-level effects array is still refused.",
  };
}
