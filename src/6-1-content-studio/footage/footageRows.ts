/**
 * Footage rows for the Content Studio "Footage" tab.
 * Same shape and filter logic as the laptop katalog.html (bank-footage), built from
 * footage_assets, footage_scenes, footage_tag_values, footage_usages, and footage_bans.
 */

export type YaTidak = "ya" | "tidak";

export interface FootageRow {
  /** scene id */
  id: string;
  assetId: string;
  img: boolean;
  tipe: "video" | "gambar";
  /** laptop path relative to bank-footage, such as PIK1/sate babi/clip.mp4 */
  f: string;
  /** scene number inside the clip, from 1 */
  sc: number;
  a: number;
  b: number;
  thumbPath: string | null;
  /** Old 480p path, if one was stored. Playback uses the laptop file, not this. */
  previewPath: string | null;
  isi: string;
  jenis: string;
  klip: string;
  lok: string;
  prod: string[];
  /** scene tag values by def key (bool or text) */
  tags: Record<string, boolean | string>;
  hijab: YaTidak;
  wm: YaTidak;
  lengkuas: YaTidak;
  meja: boolean;
  /** clip-level usage refs joined with ";" (same as katalog.html d.pakai) */
  pakai: string;
  /** usage refs for this scene */
  sp: string[];
  ban: string | null;
  cat: string;
  baru: boolean;
  /** clip tags: belum (Agent, untagged), perlu_dicek (AI, not checked), dicek (by a person) */
  tag: TagStatus;
}

export type TagStatus = "belum" | "perlu_dicek" | "dicek";

export interface AssetRecord {
  id: string;
  file_key: string;
  media_type: string;
  location_label: string | null;
  product_label: string | null;
  summary: string | null;
  storage_status: string | null;
  duration_seconds: number | string | null;
  tag_status?: string | null;
  preview_storage_path?: string | null;
}

export interface SceneRecord {
  id: string;
  asset_id: string;
  start_seconds: number | string;
  end_seconds: number | string | null;
  scene_kind: string;
  summary: string | null;
  note: string | null;
  thumb_storage_path: string | null;
}

export interface TagDefRecord {
  id: string;
  key: string;
  label?: string | null;
  value_type?: "bool" | "text" | null;
  position?: number | null;
}

export interface TagValueRecord {
  tag_def_id: string;
  asset_id: string | null;
  scene_id: string | null;
  value_bool: boolean | null;
  value_text: string | null;
}

export interface UsageRecord {
  asset_id: string;
  scene_id: string | null;
  in_seconds?: number | string | null;
  out_seconds?: number | string | null;
  external_ref: string | null;
  social_media_plan_id: string | null;
}

export interface BanRecord {
  scene_id: string;
  reason: string;
}

export interface MenuRecord {
  name: string;
  aliases: string[] | null;
}

export interface FootageSource {
  assets: AssetRecord[];
  scenes: SceneRecord[];
  tagDefs: TagDefRecord[];
  tagValues: TagValueRecord[];
  usages: UsageRecord[];
  bans: BanRecord[];
  menus: MenuRecord[];
}

export interface FootageData {
  rows: FootageRow[];
  /** product names in catalog menu order (katalog.html PORD) */
  productOrder: string[];
  /** bool tag defs that become filter groups */
  tagDefs: TagDefRecord[];
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const usageRef = (u: UsageRecord): string | null => {
  const ext = u.external_ref?.trim();
  if (ext) return ext;
  if (u.social_media_plan_id) return u.social_media_plan_id.slice(0, 8);
  return null;
};

/** Maps a footage product label to a catalog menu name using name and aliases, ignoring case. */
export function makeProductResolver(menus: MenuRecord[]): (label: string) => string {
  const map = new Map<string, string>();
  for (const m of menus) {
    const name = m.name.trim();
    if (!name) continue;
    map.set(name.toLowerCase(), name);
    for (const al of m.aliases ?? []) {
      const k = al.trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, name);
    }
  }
  return (label: string) => {
    const t = label.trim();
    return map.get(t.toLowerCase()) ?? t;
  };
}

export function buildFootageRows(src: FootageSource): FootageData {
  const resolveProduct = makeProductResolver(src.menus);
  const assets = new Map(src.assets.map((a) => [a.id, a]));
  const defKey = new Map(src.tagDefs.map((d) => [d.id, d.key]));

  const sceneTags = new Map<string, Record<string, boolean | string>>();
  for (const v of src.tagValues) {
    if (!v.scene_id) continue;
    const key = defKey.get(v.tag_def_id);
    if (!key) continue;
    const rec = sceneTags.get(v.scene_id) ?? {};
    rec[key] = v.value_bool ?? v.value_text ?? "";
    sceneTags.set(v.scene_id, rec);
  }

  const clipRefs = new Map<string, string[]>();
  const usagesByAsset = new Map<string, UsageRecord[]>();
  for (const u of src.usages) {
    const ref = usageRef(u);
    if (!ref) continue;
    const c = clipRefs.get(u.asset_id) ?? [];
    if (!c.includes(ref)) c.push(ref);
    clipRefs.set(u.asset_id, c);
    const l = usagesByAsset.get(u.asset_id) ?? [];
    l.push(u);
    usagesByAsset.set(u.asset_id, l);
  }

  /** Usage refs for one scene: linked by scene_id, or a clip usage whose in/out overlaps the scene. */
  const sceneRefsFor = (assetId: string, sceneId: string, a: number, b: number): string[] => {
    const out: string[] = [];
    for (const u of usagesByAsset.get(assetId) ?? []) {
      const ref = usageRef(u)!;
      let hit = u.scene_id === sceneId;
      if (!hit && !u.scene_id) {
        const uin = num(u.in_seconds);
        const uout = num(u.out_seconds);
        if (uin !== null && uout !== null) hit = Math.min(b, uout) - Math.max(a, uin) > 0.05;
      }
      if (hit && !out.includes(ref)) out.push(ref);
    }
    return out;
  };

  const bans = new Map(src.bans.map((b) => [b.scene_id, b.reason]));

  const byAsset = new Map<string, SceneRecord[]>();
  for (const s of src.scenes) {
    if (!assets.has(s.asset_id)) continue;
    const l = byAsset.get(s.asset_id) ?? [];
    l.push(s);
    byAsset.set(s.asset_id, l);
  }

  const yt = (v: unknown): YaTidak => (v === true || v === "ya" || v === "true" ? "ya" : "tidak");

  const rows: FootageRow[] = [];
  const orderedAssets = [...byAsset.keys()]
    .map((id) => assets.get(id)!)
    .sort((x, y) => x.file_key.localeCompare(y.file_key));

  for (const asset of orderedAssets) {
    const list = byAsset.get(asset.id)!.slice().sort((x, y) => (num(x.start_seconds) ?? 0) - (num(y.start_seconds) ?? 0));
    const img = asset.media_type === "image";
    const prod = (asset.product_label ?? "")
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map(resolveProduct);
    const dur = num(asset.duration_seconds);
    list.forEach((s, i) => {
      const a = num(s.start_seconds) ?? 0;
      const next = list[i + 1] ? num(list[i + 1].start_seconds) : null;
      const b = num(s.end_seconds) ?? next ?? dur ?? a;
      const tags = sceneTags.get(s.id) ?? {};
      // Lengkuas defaults to "ya" when the tag is missing, like the laptop catalog.
      const lengkuas: YaTidak = "lengkuas" in tags ? yt(tags.lengkuas) : "ya";
      if (!("lengkuas" in tags) && src.tagDefs.some((d) => d.key === "lengkuas")) {
        tags.lengkuas = true;
      }
      rows.push({
        id: s.id,
        assetId: asset.id,
        img,
        tipe: img ? "gambar" : "video",
        f: asset.file_key,
        sc: i + 1,
        a,
        b,
        thumbPath: s.thumb_storage_path,
        previewPath: asset.preview_storage_path ?? null,
        isi: s.summary ?? "",
        jenis: s.scene_kind,
        klip: asset.summary ?? "",
        lok: asset.location_label?.trim() || "?",
        prod,
        tags,
        hijab: yt(tags.hijab),
        wm: yt(tags.watermark_ui),
        lengkuas,
        meja: tags.meja_biru === true,
        pakai: (clipRefs.get(asset.id) ?? []).join(";"),
        sp: sceneRefsFor(asset.id, s.id, a, b),
        ban: bans.get(s.id) ?? null,
        cat: s.note ?? "",
        baru: asset.storage_status === "inbox",
        tag: asset.tag_status === "belum" || asset.tag_status === "perlu_dicek" ? asset.tag_status : "dicek",
      });
    });
  }

  const productOrder: string[] = [];
  for (const m of src.menus) {
    const n = m.name.trim();
    if (n && !productOrder.includes(n) && rows.some((r) => r.prod.includes(n))) productOrder.push(n);
  }
  // Like katalog.html PORD: only catalog menu products become filter options.

  return {
    rows,
    productOrder,
    tagDefs: [...src.tagDefs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.key.localeCompare(b.key)),
  };
}

/* ---------------------------------------------------------------------------
 * Filters (same rules as katalog.html: chips(), ok(), cnt(), cat())
 * ------------------------------------------------------------------------- */

export type FilterKey = string;
export type ViewMode = "scene" | "klip";
export type Filters = Record<string, string | null>;

const BASE_FILTER_GROUPS: { key: FilterKey; title: string }[] = [
  { key: "st", title: "Status" },
  { key: "tipe", title: "Tipe" },
  { key: "lok", title: "Lokasi" },
  { key: "prod", title: "Produk" },
  { key: "jenis", title: "Isi scene" },
  { key: "pakai", title: "Pemakaian" },
  { key: "tag", title: "Tag" },
];

/** Fixed + per-org bool tag filters (hijab, watermark_ui, capacity_shown, …). */
export function filterGroups(tagDefs: TagDefRecord[]): { key: FilterKey; title: string }[] {
  const tags = tagDefs
    .filter((d) => (d.value_type ?? "bool") === "bool")
    .map((d) => ({
      key: d.key,
      title: d.label?.trim() || d.key,
    }));
  return [...BASE_FILTER_GROUPS, ...tags];
}

/** @deprecated use filterGroups(data.tagDefs) — kept for older imports */
export const FILTER_GROUPS = filterGroups([
  { id: "1", key: "hijab", label: "Hijab", value_type: "bool", position: 1 },
  { id: "2", key: "watermark_ui", label: "Watermark / UI HP", value_type: "bool", position: 2 },
  { id: "3", key: "lengkuas", label: "Lengkuas", value_type: "bool", position: 3 },
]);

export function emptyFilters(tagDefs: TagDefRecord[] = []): Filters {
  const F: Filters = { st: null, tipe: null, lok: null, prod: null, jenis: null, pakai: null, tag: null };
  for (const d of tagDefs) {
    if ((d.value_type ?? "bool") === "bool") F[d.key] = null;
  }
  return F;
}

/** @deprecated use emptyFilters(tagDefs) */
export const EMPTY_FILTERS: Filters = emptyFilters([
  { id: "1", key: "hijab", value_type: "bool" },
  { id: "2", key: "watermark_ui", value_type: "bool" },
  { id: "3", key: "lengkuas", value_type: "bool" },
]);

export const NM: Record<string, Record<string, string>> = {
  tipe: { video: "Video", gambar: "Gambar" },
  hijab: { tidak: "Tanpa hijab", ya: "Ada hijab" },
  watermark_ui: { tidak: "Bersih", ya: "Ada watermark/UI" },
  wm: { tidak: "Bersih", ya: "Ada watermark/UI" },
  lengkuas: { ya: "Pakai lengkuas", tidak: "Tanpa lengkuas" },
  st: { boleh: "Boleh dipakai", "jangan dipakai": "Jangan dipakai" },
  pakai: { belum: "belum dipakai", "1x": "baru 1x", "2x+": "2x atau lebih" },
  tag: { perlu_dicek: "Tag AI, perlu dicek", belum: "Belum ditag", dicek: "Sudah dicek" },
  jenis: {
    produk: "produk aja",
    orang: "ada orang",
    suasana: "suasana",
    lokasi: "lokasi/jalan",
    draft: "draft",
    grafis: "grafis/logo",
    berita: "berita/artikel",
  },
};

/** Bool tags this organization actually defined, in catalog order. */
export function orgBoolTags(
  tagDefs: TagDefRecord[],
  tags: Record<string, unknown>,
): { key: string; label: string; value: YaTidak }[] {
  const yes = (v: unknown): boolean => v === true || v === "ya" || v === "true";
  return tagDefs
    .filter((d) => (d.value_type ?? "bool") === "bool")
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.key.localeCompare(b.key))
    .map((d) => ({
      key: d.key,
      label: d.label?.trim() || d.key,
      value: yes(tags[d.key]) ? "ya" : "tidak",
    }));
}

export function label(k: FilterKey, o: string, tagDefs: TagDefRecord[] = []): string {
  if (NM[k]?.[o]) return NM[k][o];
  if (tagDefs.some((d) => d.key === k && (d.value_type ?? "bool") === "bool")) {
    return o === "ya" ? "Ya" : o === "tidak" ? "Tidak" : o;
  }
  return o === "?" ? "Belum jelas" : o;
}

const uniq = (a: string[]) => [...new Set(a)].filter((x) => x !== "");

export function filterOptions(data: FootageData): Record<string, string[]> {
  const D = data.rows;
  const out: Record<string, string[]> = {
    st: ["boleh", "jangan dipakai"],
    tipe: ["video", "gambar"],
    lok: uniq(D.map((d) => d.lok)).sort(),
    prod: data.productOrder.filter((n) => D.some((d) => d.prod.includes(n))),
    jenis: uniq(D.map((d) => d.jenis)),
    pakai: ["belum", "1x", "2x+"],
    // Only when there is something to check: otherwise every clip is "Sudah dicek" and the group is noise.
    tag: D.some((d) => d.tag !== "dicek") ? ["perlu_dicek", "belum", "dicek"] : [],
  };
  for (const def of data.tagDefs) {
    if ((def.value_type ?? "bool") !== "bool") continue;
    // lengkuas chip order matches katalog.html (ya first)
    out[def.key] = def.key === "lengkuas" ? ["ya", "tidak"] : ["tidak", "ya"];
  }
  return out;
}

export function usageCount(d: FootageRow, view: ViewMode): number {
  return view === "scene" ? d.sp.length : d.pakai ? d.pakai.split(";").length : 0;
}

export function usageCat(d: FootageRow, view: ViewMode): "belum" | "1x" | "2x+" {
  const n = usageCount(d, view);
  return n === 0 ? "belum" : n === 1 ? "1x" : "2x+";
}

export function rowValue(d: FootageRow, k: FilterKey, view: ViewMode): string {
  switch (k) {
    case "st":
      return d.ban ? "jangan dipakai" : "boleh";
    case "pakai":
      return usageCat(d, view);
    case "prod":
      return d.prod.join(";");
    case "tipe":
      return d.tipe;
    case "lok":
      return d.lok;
    case "jenis":
      return d.jenis;
    case "tag":
      return d.tag;
    case "hijab":
      return d.hijab;
    case "wm":
    case "watermark_ui":
      return d.wm;
    case "lengkuas":
      return d.lengkuas;
    default: {
      const raw = d.tags[k];
      if (typeof raw === "boolean") return raw ? "ya" : "tidak";
      if (typeof raw === "string" && (raw === "ya" || raw === "tidak" || raw === "true" || raw === "false")) {
        return raw === "ya" || raw === "true" ? "ya" : "tidak";
      }
      return raw == null ? "tidak" : String(raw);
    }
  }
}

export function matches(d: FootageRow, F: Filters, q: string, view: ViewMode, skip?: FilterKey): boolean {
  for (const k of Object.keys(F) as FilterKey[]) {
    if (k === skip) continue;
    const want = F[k];
    if (want === null) continue;
    if (k === "prod") {
      if (!d.prod.includes(want)) return false;
    } else if (rowValue(d, k, view) !== want) return false;
  }
  const query = q.toLowerCase().trim();
  if (query) {
    const hay = `${d.isi} ${d.klip} ${d.cat} ${d.f} ${d.pakai} ${d.prod.join(" ")}`.toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

/** Count for one chip option, using every other active filter (katalog.html chips()). */
export function optionCount(rows: FootageRow[], F: Filters, q: string, view: ViewMode, k: FilterKey, o: string | null): number {
  const base = rows.filter((d) => matches(d, F, q, view, k));
  if (o === null) return base.length;
  return base.filter((d) => (k === "prod" ? d.prod.includes(o) : rowValue(d, k, view) === o)).length;
}

export function visibleRows(rows: FootageRow[], F: Filters, q: string, view: ViewMode): FootageRow[] {
  let L = rows.filter((d) => matches(d, F, q, view));
  if (view === "klip") {
    const seen = new Set<string>();
    L = L.filter((d) => {
      if (seen.has(d.f)) return false;
      seen.add(d.f);
      return true;
    });
  }
  return L;
}

export function countLabel(L: FootageRow[], view: ViewMode): string {
  const nk = new Set(L.map((d) => d.f)).size;
  return (view === "scene" ? `${L.length} scene · ` : "") + `${nk} klip`;
}
