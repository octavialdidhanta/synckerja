/**
 * Edits on one catalog_shot_jobs.document, ported from katalog.html
 * (shotProd/shotLok/shotDone/shotEdit/shotReset/shotDup/shotDel/shotAdd/shotArsip).
 * Every function returns a new document and keeps keys it does not know about
 * (def, dari, menu_nama, timing, saved_at ...), so Claude's MCP writes and these
 * edits read the same shape.
 */

export type ShotDoc = Record<string, unknown>;
type RawShot = Record<string, unknown>;

/** Fields of a shot that the rakit panel can change. Omitted keys stay as they are. */
export interface ShotFieldsPatch {
  action?: string;
  /** menu external ids; the first is the main dish */
  menus?: string[];
  /** location external id */
  lokasi?: string;
  /** area picked with the quick chips */
  pick?: string;
  fotos?: string[];
  bicara?: boolean;
  angle?: 1 | 2 | 3;
}

export interface ShotMetaPatch {
  judul: string;
  timing: string;
  vo: string;
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

function shotsOf(doc: ShotDoc): RawShot[] {
  return Array.isArray(doc.shots) ? (doc.shots as RawShot[]) : [];
}

function withShots(doc: ShotDoc, shots: RawShot[]): ShotDoc {
  return { ...doc, shots };
}

/** katalog.html loadShots(): a shot without def gets one from its current values. */
export function withDef(shot: RawShot): RawShot {
  if (shot.def && typeof shot.def === "object") return shot;
  return {
    ...shot,
    def: {
      action: typeof shot.action === "string" ? shot.action : "",
      menu: clone(shot.menu ?? ""),
      area: typeof shot.area === "string" ? shot.area : "",
      // No fotos yet stays no fotos: Reset then goes back to the starter selection, never to zero photos.
      ...(Array.isArray(shot.fotos) ? { fotos: clone(shot.fotos) } : {}),
      bicara: shot.bicara === true,
      angle: shot.angle || 1,
    },
  };
}

function mapShot(doc: ShotDoc, shotId: string, fn: (s: RawShot) => RawShot): ShotDoc {
  let found = false;
  const shots = shotsOf(doc).map((s) => {
    if (s.id !== shotId) return s;
    found = true;
    return fn(withDef(s));
  });
  if (!found) throw new Error("shot_not_found");
  return withShots(doc, shots);
}

export function applyShotFields(doc: ShotDoc, shotId: string, patch: ShotFieldsPatch): ShotDoc {
  return mapShot(doc, shotId, (s) => {
    const next: RawShot = { ...s };
    if (patch.action !== undefined) next.action = patch.action;
    if (patch.menus !== undefined) next.menu = patch.menus.length > 1 ? [...patch.menus] : (patch.menus[0] ?? "");
    if (patch.lokasi !== undefined) next.lokasi = patch.lokasi;
    if (patch.pick !== undefined) next.pick = patch.pick;
    if (patch.fotos !== undefined) next.fotos = [...patch.fotos];
    if (patch.bicara !== undefined) next.bicara = patch.bicara;
    if (patch.angle !== undefined) next.angle = patch.angle;
    return next;
  });
}

export function setShotDone(doc: ShotDoc, shotId: string, done: boolean): ShotDoc {
  return mapShot(doc, shotId, (s) => ({ ...s, done }));
}

/** katalog.html shotEdit(): an empty title keeps the old one; timing and VO may be empty. */
export function editShotMeta(doc: ShotDoc, shotId: string, meta: ShotMetaPatch): ShotDoc {
  return mapShot(doc, shotId, (s) => ({
    ...s,
    judul: meta.judul.trim() || s.judul,
    timing: meta.timing.trim(),
    vo: meta.vo.trim(),
  }));
}

/** katalog.html shotReset(): back to def (action, product, area, photos, speaking, angle, location). */
export function resetShot(doc: ShotDoc, shotId: string): ShotDoc {
  return mapShot(doc, shotId, (s) => {
    const d = clone(s.def) as RawShot;
    const next: RawShot = {
      ...s,
      action: d.action ?? "",
      menu: d.menu ?? "",
      area: d.area ?? "",
      bicara: d.bicara === true,
      angle: d.angle || 1,
    };
    delete next.pick;
    if (Array.isArray(d.fotos)) next.fotos = [...d.fotos];
    else delete next.fotos;
    if (d.lokasi) next.lokasi = d.lokasi;
    else delete next.lokasi;
    return next;
  });
}

/** katalog.html newId(): P01, P02 … for a new shot; P03-2, P03-3 … for a copy of P03. */
export function newShotId(doc: ShotDoc, base?: string): string {
  const shots = shotsOf(doc);
  const ids = new Set(shots.map((s) => String(s.id)));
  if (!base) {
    let k = shots.length + 1;
    while (ids.has("P" + String(k).padStart(2, "0"))) k++;
    return "P" + String(k).padStart(2, "0");
  }
  let k = 2;
  while (ids.has(`${base}-${k}`)) k++;
  return `${base}-${k}`;
}

/** katalog.html shotDup(): the copy sits right after the original, not done, with its own def. */
export function duplicateShot(doc: ShotDoc, shotId: string): { doc: ShotDoc; id: string } {
  const shots = shotsOf(doc);
  const i = shots.findIndex((s) => s.id === shotId);
  if (i < 0) throw new Error("shot_not_found");
  const c = clone(shots[i]);
  const id = newShotId(doc, String(c.id));
  c.id = id;
  c.judul = `${String(c.judul ?? "")} (copy)`;
  c.done = false;
  c.def = {
    action: c.action ?? "",
    menu: clone(c.menu ?? ""),
    area: c.area ?? "",
    ...(Array.isArray(c.fotos) ? { fotos: clone(c.fotos) } : {}),
    bicara: c.bicara === true,
    angle: c.angle || 1,
  };
  const next = [...shots];
  next.splice(i + 1, 0, c);
  return { doc: withShots(doc, next), id };
}

export function deleteShot(doc: ShotDoc, shotId: string): ShotDoc {
  const shots = shotsOf(doc);
  if (!shots.some((s) => s.id === shotId)) throw new Error("shot_not_found");
  return withShots(doc, shots.filter((s) => s.id !== shotId));
}

/** katalog.html shotAdd(): an empty shot at the end of the job. */
export function addShot(doc: ShotDoc, judul: string): { doc: ShotDoc; id: string } {
  const title = judul.trim();
  if (!title) throw new Error("empty_title");
  const id = newShotId(doc);
  const shot: RawShot = {
    id,
    judul: title,
    timing: "",
    vo: "",
    action: "",
    menu: "",
    area: "",
    // No fotos yet: the tab starts from the product photo + one location photo once they are picked.
    bicara: false,
    angle: 1,
    done: false,
    def: { action: "", menu: "", area: "", bicara: false, angle: 1 },
  };
  return { doc: withShots(doc, [...shotsOf(doc), shot]), id };
}

export function setJobArchived(doc: ShotDoc, arsip: boolean): ShotDoc {
  return { ...doc, arsip };
}

export interface ShotFromReference {
  judul: string;
  action: string;
  menu: string;
  area: string;
  lokasi: string;
  fotos: string[];
  /** reference id and beat index, e.g. "r4#6" */
  dari: string;
}

/** katalog.html beatPakai(): a reference visual becomes a new shot at the end of the job. */
export function addShotFromReference(doc: ShotDoc, src: ShotFromReference): { doc: ShotDoc; id: string } {
  const id = newShotId(doc);
  const shot: RawShot = {
    id,
    judul: src.judul,
    timing: "",
    vo: "",
    action: src.action,
    menu: src.menu,
    area: src.area,
    lokasi: src.lokasi,
    fotos: [...src.fotos],
    bicara: false,
    angle: 1,
    done: false,
    dari: src.dari,
    def: { action: src.action, menu: src.menu, area: src.area, lokasi: src.lokasi, fotos: [...src.fotos], bicara: false, angle: 1 },
  };
  return { doc: withShots(doc, [...shotsOf(doc), shot]), id };
}
