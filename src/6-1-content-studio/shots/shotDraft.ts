/** Working copy of one shot in the rakit panel, and the fields that changed since the stored shot. */
import type { LocationItem, MenuItem } from "../library/libraryData";
import { defaultSelection, locationAreas, type Talk } from "./buildFlowPrompt";
import type { Shot, ShotJob } from "./shotData";
import type { ShotFieldsPatch } from "./shotDocument";

export interface Draft {
  menuIds: string[];
  locId: string;
  talk: Talk;
  angles: 1 | 2 | 3;
  action: string;
  curArea: string;
  /** null = default selection for the current menus, location, and area */
  sel: Set<string> | null;
}

export function draftFromShot(job: ShotJob, s: Shot, menus: MenuItem[], locs: LocationItem[]): Draft {
  const lokExt = s.lokasi || job.lokasi;
  const loc = locs.find((l) => l.externalId === lokExt) ?? locs[0] ?? null;
  const areas = locationAreas(loc);
  const want = (s.pick !== undefined ? s.pick : s.area) || "";
  return {
    menuIds: s.menus.map((id) => menus.find((m) => m.externalId === id)?.id).filter((x): x is string => Boolean(x)),
    locId: loc?.id ?? "",
    talk: s.bicara ? "ngomong" : "diam",
    angles: s.angle,
    action: s.action,
    curArea: areas.includes(want) ? want : "",
    sel: s.fotos ? new Set(s.fotos) : null,
  };
}

export function effectiveSelection(d: Draft, menus: MenuItem[], locs: LocationItem[]): string[] {
  if (d.sel) return [...d.sel];
  const ms = d.menuIds.map((id) => menus.find((m) => m.id === id)).filter((m): m is MenuItem => Boolean(m));
  const loc = locs.find((l) => l.id === d.locId) ?? null;
  return [...defaultSelection(ms, loc, d.curArea)];
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;

/**
 * Only the fields the user changed against the stored shot, in stored form
 * (menu and location external ids). Nothing changed gives an empty object.
 */
export function draftToPatch(base: Draft, d: Draft, menus: MenuItem[], locs: LocationItem[]): ShotFieldsPatch {
  const patch: ShotFieldsPatch = {};
  if (d.action !== base.action) patch.action = d.action;
  if (!sameList(d.menuIds, base.menuIds)) {
    patch.menus = d.menuIds.map((id) => menus.find((m) => m.id === id)?.externalId).filter((x): x is string => Boolean(x));
  }
  if (d.locId !== base.locId) {
    const ext = locs.find((l) => l.id === d.locId)?.externalId;
    if (ext) patch.lokasi = ext;
  }
  if (d.curArea !== base.curArea) patch.pick = d.curArea;
  if (d.talk !== base.talk) patch.bicara = d.talk === "ngomong";
  if (d.angles !== base.angles) patch.angle = d.angles;
  const sel = effectiveSelection(d, menus, locs);
  if (!sameSet(sel, effectiveSelection(base, menus, locs))) patch.fotos = sel;
  return patch;
}
