/**
 * Google Flow prompt builder, ported line by line from katalog.html buildPrompt()
 * and refPhotos(). Pure functions: the UI passes the current choices in.
 */
import {
  MENU_FIELDS,
  isFilled,
  resolveMenuFields,
  type LibraryPhoto,
  type LocationItem,
  type MenuItem,
  type OrgMenuFieldDef,
} from "../library/libraryData";

export type Talk = "diam" | "ngomong";
export type PromptFields = Record<string, string>;

export interface RefPhoto extends LibraryPhoto {
  tp: "Produk" | "Lokasi";
}

/** "@file-name" without folder and extension, as katalog.html ftag(). */
export const ftag = (p: { file: string }) => "@" + (p.file || "").split("/").pop()!.replace(/\.[^.]+$/, "");

/** All photos the shot can use: product photos first, then location photos (refPhotos ALL). */
export function allPhotos(menus: MenuItem[], loc: LocationItem | null): RefPhoto[] {
  const mp: RefPhoto[] = menus.flatMap((m) => m.fotos.map((f) => ({ ...f, tp: "Produk" as const })));
  const lp: RefPhoto[] = (loc?.fotos ?? []).map((f) => ({ ...f, tp: "Lokasi" as const }));
  return [...mp, ...lp];
}

/** Areas named on the location photos, in order. */
export function locationAreas(loc: LocationItem | null): string[] {
  return [...new Set((loc?.fotos ?? []).flatMap((f) => f.area ?? []))];
}

/** Default selection when nothing is picked: every product photo plus location photos of the area (or all). */
export function defaultSelection(menus: MenuItem[], loc: LocationItem | null, area: string): Set<string> {
  const mp = menus.flatMap((m) => m.fotos.map((f) => f.file));
  const lp = (loc?.fotos ?? []).filter((f) => !area || (f.area ?? []).includes(area)).map((f) => f.file);
  return new Set([...mp, ...lp]);
}

export interface PromptInput {
  fields: PromptFields;
  /** first menu is the main one; more menus mean several dishes together */
  menus: MenuItem[];
  loc: LocationItem | null;
  /** photos in use, in display order */
  refs: RefPhoto[];
  action: string;
  talk: Talk;
  angles: 1 | 2 | 3;
  /** area chosen with the quick area chips ("" = all photos) */
  curArea: string;
  /** area the shot was written for (shot list only) */
  shotArea?: string;
  /** menu ids of the shot that have no ready catalog entry, with display names */
  missingMenus?: string[];
  /** every catalog menu, to name the dish that owns a product photo */
  allMenus: MenuItem[];
  /** org product field defs; falls back to F&B MENU_FIELDS */
  menuFieldDefs?: OrgMenuFieldDef[] | null;
}

export interface PromptResult {
  text: string;
  warnings: string[];
  /** area the location part was built for */
  area: string;
  /** labels of location views in use */
  views: string[];
  noLocationPhoto: boolean;
}

const INTEGRITY_ONE_SHOT = "One continuous shot with no cuts, no angle changes and no transitions.";

export function buildFlowPrompt(p: PromptInput): PromptResult {
  const T = p.fields;
  const o: string[] = [];
  o.push("# " + (T.judul ?? ""), "", "## 1. Format & Light", T.format ?? "", "");
  let n = 2;

  const slp = p.refs.filter((r) => r.tp === "Lokasi");
  const sa = [...new Set(slp.flatMap((r) => r.area ?? []))];
  const pa = p.shotArea ?? "";
  const ar =
    p.curArea && (sa.includes(p.curArea) || !slp.length)
      ? p.curArea
      : pa && sa.includes(pa)
        ? pa
        : sa.length === 1
          ? sa[0]
          : !slp.length && pa
            ? pa
            : "";

  let views: string[] = [];
  const l = p.loc;
  if (l) {
    o.push(`## ${n++}. Location — ${l.nama}`);
    const bg = l.bagian.filter((b) => b.isi);
    bg.filter((b) => b.judul === "Scene").forEach((b) => o.push("", `### ${b.judul}`, b.isi));
    const vw = slp.filter((r) => r.desc);
    if (vw.length) {
      o.push(
        "",
        vw.length > 1
          ? "### What The Camera Sees (only these parts of the location appear, exactly as in the matching reference photos)"
          : "### What The Camera Sees (only this part of the location appears, exactly as in the reference photo)",
      );
      vw.forEach((r) => o.push("", `#### ${ftag(r)}`, r.desc ?? ""));
    }
    bg.filter((b) => b.judul !== "Scene").forEach((b) => o.push("", `### ${b.judul}`, b.isi));
    o.push("");
    views = vw.map((r) => r.label || ftag(r));
  }

  const menuFields = resolveMenuFields(p.menuFieldDefs);
  const ms = p.menus;
  if (ms.length > 1) {
    o.push(
      `## ${n++}. Main Subjects — ${ms.length} dishes together`,
      "All of these dishes appear together in the shot. Keep each one exactly as described:",
    );
    ms.forEach((m) => {
      const F = m.fields;
      o.push("", `### ${m.nama}`, F.main || "");
      menuFields
        .filter(([k]) => k !== "main" && k !== "khusus" && k !== "larangan")
        .forEach(([k, lb]) => {
          if (F[k]) o.push(`${lb}: ${F[k]}`);
        });
      if (F.larangan) o.push("Must NOT: " + F.larangan);
    });
    o.push("");
  } else {
    ms.forEach((m) => {
      o.push(`## ${n++}. Main Subject — ${m.nama}`);
      menuFields.filter(([k]) => k !== "khusus" && k !== "larangan").forEach(([k, lb]) => {
        const v = m.fields[k];
        if (v) o.push("", `### ${lb}`, v);
      });
      if (m.fields.larangan) o.push("", "### Must NOT", m.fields.larangan);
      o.push("");
    });
  }

  if (p.refs.length) {
    o.push(
      `## ${n++}. Reference Photos`,
      "Use the attached reference images for the exact look of the food and the place (follow the ACTION for framing and layout):",
    );
    p.refs.forEach((r) => {
      const owner = p.allMenus.find((m) => m.fotos.some((f) => f.file === r.file));
      const what =
        r.tp === "Produk"
          ? r.ref
            ? r.ref
            : `the exact look of ${owner?.nama ?? "the dish"} (size, color, plating)`
          : r.ref || r.label || "the location";
      o.push(`- ${ftag(r)} — ${what}`);
    });
    o.push("");
  }

  const N = p.angles;
  const integrity =
    N > 1
      ? (T.integrity ?? "").replace(
          INTEGRITY_ONE_SHOT,
          "Hard cuts happen only between the camera angles described below; no other cuts or transitions.",
        )
      : (T.integrity ?? "");
  o.push(`## ${n++}. Visual Style`, T.visual ?? "", "", `## ${n++}. Audio`, T.audio ?? "", "", `## ${n++}. Scene Integrity`, integrity, "");
  if (N > 1 && T.multi_angle) {
    const s = (v: number) => v.toFixed(1).replace(".0", "");
    const list = (T.angle_list ?? "").split("\n").slice(0, N).join("\n");
    o.push(
      `## ${n++}. Camera Angles (${N} cuts)`,
      T.multi_angle
        .replace("{N}", String(N))
        .replace("{S}", `${s(8 / N)}–${s(10 / N)}`)
        .replace("{FRAC}", N === 2 ? "half" : "one third")
        .replace("{LIST}", list),
      "",
    );
  }
  if (T.ramai && l) o.push(`## ${n++}. Background Crowd`, T.ramai, "");
  if (T[p.talk]) o.push(`## ${n++}. Speaking`, T[p.talk], "");
  o.push(
    `## ${n++}. Shot Independence`,
    N > 1
      ? "Camera angles, distance and framing follow the ACTION and the Camera Angles section above. Character position and action follow only the ACTION below. Do not repeat the angle or action of previous shots."
      : (T.independence ?? ""),
    "",
    `## ${n++}. Action`,
    p.action.trim() || "(tulis action di atas)",
  );
  [...new Set(ms.map((m) => m.fields.khusus).filter(Boolean))].forEach((k) => o.push("", k));
  if (p.talk === "diam" && T.diam_akhir) o.push("", T.diam_akhir);

  const warnings: string[] = [];
  const m0 = ms[0];
  if (m0 && !isFilled(m0)) warnings.push("produk belum ada deskripsinya");
  if (l && !isFilled(l)) warnings.push("lokasi belum ada deskripsinya");
  if (l && !slp.length) warnings.push("belum ada foto lokasi yang dicentang");
  if (p.missingMenus?.length) warnings.push("produk belum ada di katalog: " + p.missingMenus.join(", "));
  if (pa && l && ar && ar !== pa)
    warnings.push(
      `action shot ini ditulis untuk area ${pa}, tapi foto yang dipakai area ${ar}: sesuaikan action-nya atau pilih foto ${pa}`,
    );

  return { text: o.join("\n"), warnings, area: ar, views, noLocationPhoto: Boolean(l) && !slp.length };
}
