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
}

/** Attach a source to the catalog row that already uses its name. A second row would give Anthropic two spellings. */
export function existingMenuForSource(
  sourceName: string,
  menus: MenuLink[],
  source: "item" | "feature",
): { menuId: string } | { create: true } | { error: string } {
  const needle = sourceName.trim().toLowerCase();
  const match = menus.find((menu) => menu.nama.trim().toLowerCase() === needle);
  if (!match) return { create: true };
  const taken = source === "item" ? match.defaultPriceId || match.featureId : match.featureId || match.defaultPriceId;
  if (taken) return { error: "Nama ini sudah tertaut." };
  return { menuId: match.id };
}

export function unlinkedSources<T extends { id: string }>(sources: T[], menus: MenuLink[], source: "item" | "feature"): T[] {
  const used = new Set(
    menus.map((menu) => (source === "item" ? menu.defaultPriceId : menu.featureId)).filter((id): id is string => Boolean(id)),
  );
  return sources.filter((item) => !used.has(item.id));
}

export function linkedProductName(
  menu: { nama: string; defaultPriceId: string | null; featureId: string | null },
  sources: { id: string; name: string }[],
): string {
  const id = menu.defaultPriceId ?? menu.featureId;
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
