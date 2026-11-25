import { catalogNameKey } from "../../../supabase/functions/_shared/describeCatalogProduct";

/** Slug for catalog_menus.external_id and catalog_locations.external_id. */
export function catalogSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
}

/** First free slug. `taken` is every external_id already used in this organization. */
export function uniqueCatalogSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const suffix = `-${n}`;
    const next = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!taken.includes(next)) return next;
  }
  return base;
}

/** Comma-separated aliases. Empty pieces are skipped. Repeats are kept once. */
export function parseAliases(raw: string): { aliases: string[] } | { error: string } {
  const aliases: string[] = [];
  for (const part of raw.split(",")) {
    const alias = part.trim();
    if (!alias) continue;
    if (alias.length > 200) return { error: "Alias terlalu panjang." };
    if (!aliases.some((item) => item.toLowerCase() === alias.toLowerCase())) aliases.push(alias);
  }
  return { aliases };
}

export function productDraftError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Isi nama produk.";
  if (trimmed.length > 200) return "Nama produk terlalu panjang.";
  if (!catalogSlug(trimmed)) return "Nama perlu huruf atau angka.";
  return null;
}

export interface MenuLink {
  id: string;
  nama: string;
  defaultPriceId: string | null;
  featureId: string | null;
  subServiceId?: string | null;
}

export interface StudioSourceInput {
  id: string;
  name: string;
  photoPath: string | null;
}

export interface StudioSubcategoryInput extends StudioSourceInput {
  catalogProductId: string | null;
}

export interface StudioSource extends StudioSourceInput {
  kind: "item" | "feature" | "subcategory";
}

function namedSource(row: StudioSourceInput, kind: StudioSource["kind"]): StudioSource[] {
  const name = row.name.trim();
  if (!name) return [];
  return [{ id: row.id, name, photoPath: row.photoPath, kind }];
}

/** Item Library products, plus content-plan subcategories that are not already a product. */
export function studioProductSources(products: StudioSourceInput[], subcategories: StudioSubcategoryInput[]): StudioSource[] {
  const items = products.flatMap((row) => namedSource(row, "item"));
  const productKeys = new Set(items.map((row) => catalogNameKey(row.name)).filter(Boolean));
  const subs = subcategories.flatMap((row) => {
    if (row.catalogProductId) return [];
    const source = namedSource(row, "subcategory");
    const key = source[0] ? catalogNameKey(source[0].name) : "";
    if (!key || productKeys.has(key)) return [];
    return source;
  });
  return [...items, ...subs];
}

export { catalogNameKey };

/** Attach a source to the catalog row that already uses its name. A second row would give Anthropic two spellings. */
export function existingMenuForSource(
  sourceName: string,
  menus: MenuLink[],
): { menuId: string } | { create: true } | { error: string } {
  const needle = catalogNameKey(sourceName);
  if (!needle) return { create: true };
  const matches = menus.filter((menu) => catalogNameKey(menu.nama) === needle);
  if (matches.length > 1) return { error: "Ada lebih dari satu produk dengan nama ini." };
  const match = matches[0];
  if (!match) return { create: true };
  if (match.defaultPriceId || match.featureId || match.subServiceId) return { error: "Nama ini sudah tertaut." };
  return { menuId: match.id };
}

export function unlinkedSources<T extends { id: string; name?: string; kind?: string }>(sources: T[], menus: MenuLink[]): T[] {
  const used = new Set(
    menus.flatMap((menu) => [menu.defaultPriceId, menu.featureId, menu.subServiceId]).filter((id): id is string => Boolean(id)),
  );
  const menuKeys = new Set(menus.map((menu) => catalogNameKey(menu.nama)).filter(Boolean));
  return sources.filter((item) => {
    if (used.has(item.id)) return false;
    if (item.kind === "subcategory" && item.name && menuKeys.has(catalogNameKey(item.name))) return false;
    return true;
  });
}

export function sourceForMenu(
  menu: { nama: string; defaultPriceId: string | null; featureId: string | null; subServiceId?: string | null },
  sources: StudioSource[],
): StudioSource | null {
  const byId = sources.find((source) =>
    (source.kind === "item" && source.id === menu.defaultPriceId)
    || (source.kind === "feature" && source.id === menu.featureId)
    || (source.kind === "subcategory" && source.id === menu.subServiceId));
  if (byId) return byId;
  if (menu.defaultPriceId || menu.featureId || menu.subServiceId) return null;
  const key = catalogNameKey(menu.nama);
  if (!key) return null;
  return sources.find((source) => source.kind === "subcategory" && catalogNameKey(source.name) === key) ?? null;
}

export function linkedProductName(
  menu: { nama: string; defaultPriceId: string | null; featureId: string | null; subServiceId?: string | null },
  sources: { id: string; name: string }[],
): string {
  const id = menu.defaultPriceId ?? menu.featureId ?? menu.subServiceId;
  if (!id) return menu.nama;
  return sources.find((source) => source.id === id)?.name ?? menu.nama;
}

export function locationDraftError(label: string, name: string): string | null {
  const short = label.trim();
  if (!short || short === "?") return "Isi label lokasi.";
  if (short.length > 80) return "Label lokasi terlalu panjang.";
  const title = (name.trim() || short);
  if (title.length > 200) return "Judul lokasi terlalu panjang.";
  if (!catalogSlug(short)) return "Label perlu huruf atau angka.";
  return null;
}
