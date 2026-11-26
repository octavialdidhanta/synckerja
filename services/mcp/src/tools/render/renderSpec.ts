import { z } from "zod";

/**
 * Render job spec v1: what the laptop Agent renders (step 6 of the Synckerja Agent task).
 * Same building blocks as the video editor's spec_capcut.json, but shots point at catalog footage
 * (file_key + in/out seconds) instead of pre-cut clips, so the Agent cuts them itself, frame-exact.
 * Audio files are paths inside the production folder on the laptop (for example vo/VO_full.mp3).
 * Unknown keys are refused: the Agent only does what it was built for.
 */

const relPath = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((p) => !p.startsWith("/") && !p.startsWith("\\") && !/^[A-Za-z]:/.test(p) && !/(^|[\\/])\.\.([\\/]|$)/.test(p), {
    message: "path must stay inside the production folder",
  });

const folderName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((p) => !/[\\/]/.test(p) && p !== "." && p !== "..", { message: "one folder name, no slashes" });

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const sec = z.number().finite().min(0).max(3600);

export const renderStyle = z
  .object({
    size: z.number().min(2).max(40),
    color: color.optional(),
    bg: color.optional(),
    bg_alpha: z.number().min(0).max(1).optional(),
    stroke: color.optional(),
    stroke_width: z.number().min(0).max(1).optional(),
    bold: z.boolean().optional(),
    font: z.enum(["poppins", "instrument-serif"]).optional(),
    x: z.number().min(-1).max(1).optional(),
    y: z.number().min(-1).max(1).optional(),
    max_width: z.number().min(0.1).max(1).optional(),
    /** anim "highlight": colour of the word being spoken (Gaya baku: kuning #FFD640). */
    highlight: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .strict();

export const renderSpecV1 = z
  .object({
    version: z.literal(1),
    production: folderName,
    output_name: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9 _.()-]+$/),
    shots: z
      .array(
        z
          .object({
            file_key: z.string().trim().min(1).max(2000),
            in: sec,
            out: sec,
            label: z.string().trim().max(80).optional(),
          })
          .strict()
          .refine((s) => s.out - s.in >= 1 / 30, { message: "a shot needs at least one frame" }),
      )
      .min(1)
      .max(80),
    audio: z
      .object({
        vo: z.object({ file: relPath, at: sec.optional(), db: z.number().min(-60).max(12).optional() }).strict().optional(),
        /** VO per storyboard row at its own second (Agent 0.1.15+); instead of one vo file. */
        vo_parts: z
          .array(z.object({ file: relPath, at: sec, db: z.number().min(-60).max(12).optional() }).strict())
          .min(1)
          .max(60)
          .optional(),
        music: z
          .object({
            file: relPath,
            at: sec.optional(),
            in: sec.optional(),
            db: z.number().min(-60).max(12).optional(),
            fade_in: z.number().min(0).max(10).optional(),
            fade_out: z.number().min(0).max(10).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .refine((a) => !(a.vo && a.vo_parts), { message: "use vo or vo_parts, not both" })
      .default({}),
    styles: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,31}$/), renderStyle).default({}),
    texts: z
      .array(
        z
          .object({
            text: z.string().min(1).max(300),
            start: sec,
            end: sec,
            style: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
            layer: z.number().int().min(0).max(9).optional(),
            /** wa_button (CTWA closer button) and rise (label rising from below) need Agent 0.1.23+. */
            anim: z.enum(["none", "fade", "pop", "typewriter", "menu_label", "highlight", "pop_shake", "slide", "wa_button", "rise"]).optional(),
            /**
             * anim "highlight": when each word is spoken, in seconds on the final video (from the VO word timings).
             * Without it the words light up one after another, timed by their length.
             */
            words: z
              .array(z.object({ text: z.string().min(1).max(60), start: z.number().min(0).max(3600), end: z.number().min(0).max(3600) }).strict())
              .max(60)
              .optional(),
            /** Draw under the person matte on the laptop Agent (SAM2 gate + RVM foreground). */
            behind_person: z.boolean().optional(),
          })
          .strict()
          .refine((t) => t.end > t.start),
      )
      .max(200)
      .default([]),
    /**
     * Still preview (Agent 0.1.18+): render only these seconds of the final video (texts, motion and outro drawn) as one
     * contact sheet in <production>/_build/still/. No audio, QC, upload or footage usage.
     */
    stills: z.array(z.number().finite().min(0).max(3600)).min(1).max(12).optional(),
    /** End card. Halftone covers the last `seconds` (default 1) then fades to white. */
    outro: z
      .object({
        kind: z.literal("halftone"),
        seconds: z.number().finite().min(0.4).max(3).optional(),
        logo: relPath.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((s) => s.texts.every((t) => t.style in s.styles), { message: "every text needs a style defined in styles" });

export type RenderSpecV1 = z.infer<typeof renderSpecV1>;

export function specDuration(spec: RenderSpecV1): number {
  return spec.shots.reduce((sum, s) => sum + Math.round((s.out - s.in) * 30) / 30, 0);
}
