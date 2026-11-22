/** Shot list jobs from catalog_shot_jobs.document (the original shotlist.json jobs). */
import { isFilled, type MenuItem } from "../library/libraryData";

export interface Shot {
  id: string;
  judul: string;
  timing: string;
  vo: string;
  action: string;
  menus: string[];
  /** location external id; empty means the job location */
  lokasi: string;
  area: string;
  /** area picked with the quick chips; undefined when never picked */
  pick?: string;
  /** photo files in use; undefined means the default selection */
  fotos?: string[];
  bicara: boolean;
  angle: 1 | 2 | 3;
  done: boolean;
  menuNames: Record<string, string>;
}

export interface ShotJob {
  id: string;
  judul: string;
  lokasi: string;
  arsip: boolean;
  tetap: boolean;
  shots: Shot[];
}

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function shotMenus(menu: unknown): string[] {
  if (Array.isArray(menu)) return menu.filter((x): x is string => typeof x === "string" && x !== "");
  return typeof menu === "string" && menu ? [menu] : [];
}

export function parseShotJob(externalId: string, doc: Doc): ShotJob {
  const shots = Array.isArray(doc.shots) ? (doc.shots as Doc[]) : [];
  return {
    id: externalId,
    judul: str(doc.judul) || externalId,
    lokasi: str(doc.lokasi),
    arsip: doc.arsip === true,
    tetap: doc.tetap === true,
    shots: shots.map((s, i) => {
      const a = Number(s.angle);
      return {
        id: str(s.id) || `P${String(i + 1).padStart(2, "0")}`,
        judul: str(s.judul),
        timing: str(s.timing),
        vo: str(s.vo),
        action: str(s.action),
        menus: shotMenus(s.menu),
        lokasi: str(s.lokasi),
        area: str(s.area),
        pick: "pick" in s ? str(s.pick) : undefined,
        fotos: Array.isArray(s.fotos) ? (s.fotos as unknown[]).filter((f): f is string => typeof f === "string") : undefined,
        bicara: s.bicara === true,
        angle: a === 2 || a === 3 ? a : 1,
        done: s.done === true,
        menuNames: (s.menu_nama && typeof s.menu_nama === "object" ? s.menu_nama : {}) as Record<string, string>,
      };
    }),
  };
}

/** Active jobs (fixed ones first) and archived jobs, as katalog.html shotList(). */
export function splitJobs(jobs: ShotJob[]): { active: ShotJob[]; archived: ShotJob[] } {
  const active = jobs.filter((j) => !j.arsip).sort((a, b) => Number(b.tetap) - Number(a.tetap));
  return { active, archived: jobs.filter((j) => j.arsip) };
}

/** Menu ids of a shot that are missing or not described in the catalog, as display names. */
export function missingMenus(shot: Pick<Shot, "menus" | "menuNames">, menus: MenuItem[]): string[] {
  return shot.menus
    .filter((id) => !menus.some((m) => m.externalId === id && isFilled(m)))
    .map((id) => shot.menuNames[id] || id);
}
