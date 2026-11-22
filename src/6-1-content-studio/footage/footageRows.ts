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
  isi: string;
  jenis: string;
  klip: string;
  lok: string;
  prod: string[];
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
}

export interface AssetRecord {
  id: string;
  file_key: string;
  media_type: string;
  location_label: string | null;
  product_label: string | null;
  summary: string | null;
  storage_status: string | null;
  duration_seconds: number | string | null;
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
  const sceneRefs = new Map<string, string[]>();
  for (const u of src.usages) {
    const ref = usageRef(u);
    if (!ref) continue;
    const c = clipRefs.get(u.asset_id) ?? [];
    if (!c.includes(ref)) c.push(ref);
    clipRefs.set(u.asset_id, c);
    if (u.scene_id) {
      const s = sceneRefs.get(u.scene_id) ?? [];
      if (!s.includes(ref)) s.push(ref);
      sceneRefs.set(u.scene_id, s);
    }
  }

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
        isi: s.summary ?? "",
        jenis: s.scene_kind,
        klip: asset.summary ?? "",
        lok: asset.location_label?.trim() || "?",
        prod,
        hijab: yt(tags.hijab),
        wm: yt(tags.watermark_ui),
        lengkuas,
        meja: tags.meja_biru === true,
        pakai: (clipRefs.get(asset.id) ?? []).join(";"),
        sp: sceneRefs.get(s.id) ?? [],
        ban: bans.get(s.id) ?? null,
        cat: s.note ?? "",
        baru: asset.storage_status === "inbox",
      });
    });
  }

  const productOrder: string[] = [];
  for (const m of src.menus) {
    const n = m.name.trim();
    if (n && !productOrder.includes(n) && rows.some((r) => r.prod.includes(n))) productOrder.push(n);
  }
  // Like katalog.html PORD: only catalog menu products become filter options.

  return { rows, productOrder };
}

/* ---------------------------------------------------------------------------
 * Filters (same rules as katalog.html: chips(), ok(), cnt(), cat())
 * ------------------------------------------------------------------------- */

export type FilterKey = "st" | "tipe" | "lok" | "prod" | "jenis" | "pakai" | "hijab" | "wm" | "lengkuas";
export type ViewMode = "scene" | "klip";
export type Filters = Record<FilterKey, string | null>;

export const FILTER_GROUPS: { key: FilterKey; title: string }[] = [
  { key: "st", title: "Status" },
  { key: "tipe", title: "Tipe" },
  { key: "lok", title: "Lokasi" },
  { key: "prod", title: "Produk" },
  { key: "jenis", title: "Isi scene" },
  { key: "pakai", title: "Pemakaian" },
  { key: "hijab", title: "Hijab" },
  { key: "wm", title: "Watermark / UI HP" },
  { key: "lengkuas", title: "Lengkuas" },
];

export const EMPTY_FILTERS: Filters = {
  st: null,
  tipe: null,
  lok: null,
  prod: null,
  jenis: null,
  pakai: null,
  hijab: null,
  wm: null,
  lengkuas: null,
};

export const NM: Record<string, Record<string, string>> = {
  tipe: { video: "Video", gambar: "Gambar" },
  hijab: { tidak: "Tanpa hijab", ya: "Ada hijab" },
  wm: { tidak: "Bersih", ya: "Ada watermark/UI" },
  lengkuas: { ya: "Pakai lengkuas", tidak: "Tanpa lengkuas" },
  st: { boleh: "Boleh dipakai", "jangan dipakai": "Jangan dipakai" },
  pakai: { belum: "belum dipakai", "1x": "baru 1x", "2x+": "2x atau lebih" },
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

export function label(k: FilterKey, o: string): string {
  return NM[k]?.[o] ?? (o === "?" ? "Belum jelas" : o);
}

const uniq = (a: string[]) => [...new Set(a)].filter((x) => x !== "");

export function filterOptions(data: FootageData): Record<FilterKey, string[]> {
  const D = data.rows;
  return {
    st: ["boleh", "jangan dipakai"],
    tipe: ["video", "gambar"],
    lok: uniq(D.map((d) => d.lok)).sort(),
    prod: data.productOrder.filter((n) => D.some((d) => d.prod.includes(n))),
    jenis: uniq(D.map((d) => d.jenis)),
    pakai: ["belum", "1x", "2x+"],
    hijab: ["tidak", "ya"],
    wm: ["tidak", "ya"],
    lengkuas: ["ya", "tidak"],
  };
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
    default:
      return d[k];
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
