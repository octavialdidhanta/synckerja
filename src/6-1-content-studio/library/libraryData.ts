/**
 * Produk and Lokasi tabs of Content Studio, same shape as the laptop katalog.html
 * (MENU and LOK arrays), built from catalog_menus / catalog_locations and their rows.
 */

/** F&B default — prefer org `catalog_menu_field_defs` via resolveMenuFields(). */
export const MENU_FIELDS: [key: string, label: string][] = [
  ["main", "Main Subject"],
  ["topping", "Signature Topping"],
  ["garnish", "Side Garnishes"],
  ["presentation", "Presentation"],
  ["sauce", "Dipping Sauce"],
  ["larangan", "Larangan (must NOT)"],
  ["khusus", "Aturan khusus"],
];

export type OrgMenuFieldDef = { field_key: string; label: string; position?: number };

/** Org field defs when present; otherwise F&B defaults. */
export function resolveMenuFields(defs?: OrgMenuFieldDef[] | null): [key: string, label: string][] {
  if (defs && defs.length) {
    return [...defs]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.field_key.localeCompare(b.field_key))
      .map((d) => [d.field_key, d.label] as [string, string]);
  }
  return MENU_FIELDS;
}

export interface LibraryPhoto {
  id: string;
  file: string;
  label: string;
  storagePath: string | null;
  /** how the prompt names this photo in Reference Photos */
  ref?: string;
  /** location photos only */
  desc?: string;
  area?: string[];
}

export interface MenuItem {
  id: string;
  externalId: string;
  nama: string;
  aliases: string[];
  fotos: LibraryPhoto[];
  fields: Record<string, string>;
}

export interface LocationSection {
  judul: string;
  isi: string;
  area: string[];
}

export interface LocationItem {
  id: string;
  externalId: string;
  nama: string;
  fotos: LibraryPhoto[];
  bagian: LocationSection[];
}

export interface MenuRow {
  id: string;
  external_id: string;
  name: string;
  aliases: string[] | null;
  created_at: string;
}
export interface MenuFieldRow {
  menu_id: string;
  field_key: string;
  body: string;
  position: number;
}
export interface MenuPhotoRow {
  id: string;
  menu_id: string;
  file_path: string;
  label: string;
  storage_path: string | null;
  ref?: string | null;
  position: number;
}
export interface LocationRow {
  id: string;
  external_id: string;
  name: string;
  created_at: string;
}
export interface LocationPhotoRow {
  id: string;
  location_id: string;
  file_path: string;
  label: string;
  storage_path: string | null;
  ref?: string | null;
  description: string | null;
  areas: string[] | null;
  position: number;
}
export interface LocationSectionRow {
  location_id: string;
  title: string;
  body: string;
  areas: string[] | null;
  position: number;
}

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
const byCreated = <T extends { created_at: string; external_id: string }>(a: T, b: T) =>
  a.created_at.localeCompare(b.created_at) || a.external_id.localeCompare(b.external_id);

export function buildMenus(menus: MenuRow[], fields: MenuFieldRow[], photos: MenuPhotoRow[]): MenuItem[] {
  return menus
    .slice()
    .sort(byCreated)
    .map((m) => {
      const f: Record<string, string> = {};
      for (const r of fields.filter((x) => x.menu_id === m.id).sort(byPos)) f[r.field_key] = r.body;
      return {
        id: m.id,
        externalId: m.external_id,
        nama: m.name,
        aliases: m.aliases ?? [],
        fields: f,
        fotos: photos
          .filter((p) => p.menu_id === m.id)
          .sort(byPos)
          .map((p) => ({ id: p.id, file: p.file_path, label: p.label, storagePath: p.storage_path, ref: p.ref ?? "" })),
      };
    });
}

export function buildLocations(
  locs: LocationRow[],
  photos: LocationPhotoRow[],
  sections: LocationSectionRow[],
): LocationItem[] {
  return locs
    .slice()
    .sort(byCreated)
    .map((l) => ({
      id: l.id,
      externalId: l.external_id,
      nama: l.name,
      fotos: photos
        .filter((p) => p.location_id === l.id)
        .sort(byPos)
        .map((p) => ({
          id: p.id,
          file: p.file_path,
          label: p.label,
          storagePath: p.storage_path,
          ref: p.ref ?? "",
          desc: p.description ?? "",
          area: p.areas ?? [],
        })),
      bagian: sections
        .filter((s) => s.location_id === l.id)
        .sort(byPos)
        .map((s) => ({ judul: s.title, isi: s.body, area: s.areas ?? [] })),
    }));
}

/** katalog.html filled(): a menu needs one field; a location needs a section body or a photo description. */
export function isFilled(x: MenuItem | LocationItem): boolean {
  if ("fields" in x) return Object.values(x.fields).some((v) => v && v.trim());
  return x.bagian.some((b) => b.isi && b.isi.trim()) || x.fotos.some((f) => f.desc && f.desc.trim());
}
