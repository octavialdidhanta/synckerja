/**
 * Shot list shots as Content Studio (Shot List tab) reads them. Every shot a tool saves must carry the fields the
 * Flow prompt builder uses, so all shot lists look and behave the same:
 * - fotos: the catalog photo files this shot uses (product photo + one fitting location photo). Without it the tab
 *   falls back to every product photo and every location photo of the area. [] is allowed for a shot that is filmed
 *   with a phone and has no reference photo.
 * - action: the Flow prompt in English; a shot that shows the talent opens with the THE TALENT block from
 *   Gaya baku talent, worded the same in every shot of the job.
 * - angle, bicara, done, def: filled here when missing (def = the shot's own values, what "Reset ke default" restores).
 */

type Doc = Record<string, unknown>;

export interface ShotlistFinding {
  code: string;
  shots: string[];
  message: string;
}

export interface ShotlistCheck {
  errors: ShotlistFinding[];
  warnings: ShotlistFinding[];
}

const PERSON = /\b(he|his|him|the man|the woman|the talent|the creator)\b/i;

function shotsOf(doc: Doc): Doc[] {
  return Array.isArray(doc.shots) ? (doc.shots as Doc[]) : [];
}

function idOf(shot: Doc, i: number): string {
  return typeof shot.id === "string" && shot.id.trim() ? shot.id.trim() : `#${i + 1}`;
}

export function checkShotlistShots(doc: Doc): ShotlistCheck {
  const noFotos: string[] = [];
  const noAction: string[] = [];
  const noTalent: string[] = [];
  shotsOf(doc).forEach((shot, i) => {
    const id = idOf(shot, i);
    const fotos = shot.fotos;
    if (!Array.isArray(fotos) || fotos.some((f) => typeof f !== "string" || !f.trim())) noFotos.push(id);
    const action = typeof shot.action === "string" ? shot.action.trim() : "";
    if (!action) noAction.push(id);
    else if (PERSON.test(action) && !/THE TALENT/.test(action)) noTalent.push(id);
  });
  const errors: ShotlistFinding[] = [];
  const warnings: ShotlistFinding[] = [];
  if (noFotos.length) {
    errors.push({
      code: "shot_fotos_missing",
      shots: noFotos,
      message:
        "Every shot needs fotos: the catalog photo files it uses (file_path from catalog.product.get and catalog.location.get), "
        + "usually the product photo plus one location photo that fits the shot. Use [] only for a shot filmed with a phone "
        + "without a reference photo. Without fotos Content Studio selects every photo of the area.",
    });
  }
  if (noAction.length) {
    errors.push({ code: "shot_action_missing", shots: noAction, message: "Every shot needs an action: the Flow prompt in English." });
  }
  if (noTalent.length) {
    warnings.push({
      code: "shot_talent_block_missing",
      shots: noTalent,
      message:
        "These actions show a person but do not open with the THE TALENT block (from Gaya baku talent, the same words in "
        + "every shot of the job), so Flow may draw a different person in each shot.",
    });
  }
  return { errors, warnings };
}

/** Fills angle, bicara, done and def the way Content Studio stores them; nothing else changes. */
export function normalizeShotlistDocument<T extends Doc>(doc: T): T {
  const shots = shotsOf(doc).map((shot) => {
    const angle = shot.angle === 2 || shot.angle === 3 ? shot.angle : 1;
    const next: Doc = { ...shot, angle, bicara: shot.bicara === true, done: shot.done === true };
    if (!next.def || typeof next.def !== "object") {
      const def: Doc = {
        action: typeof shot.action === "string" ? shot.action : "",
        menu: shot.menu ?? "",
        area: typeof shot.area === "string" ? shot.area : "",
        bicara: next.bicara,
        angle,
      };
      if (Array.isArray(shot.fotos)) def.fotos = [...(shot.fotos as unknown[])];
      if (typeof shot.lokasi === "string" && shot.lokasi) def.lokasi = shot.lokasi;
      next.def = def;
    }
    return next;
  });
  return { ...doc, shots };
}

export const SHOTLIST_CHECK_NEXT_STEP =
  "Nothing was previewed. Fix every item in errors (add fotos and action to the listed shots), then preview again.";
