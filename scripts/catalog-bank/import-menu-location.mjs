/**
 * Import menu.json and lokasi.json into the catalog tables.
 *
 * Does not read or write footage, Product Knowledge, or photo bytes.
 * Run this only after migration 20261122170000 is applied.
 * A later run replaces child rows and drops products or locations
 * that are no longer in the JSON. An existing product_knowledge_id is kept.
 *
 *   node scripts/catalog-bank/import-menu-location.mjs --dir "D:\Sate Sultan\Sate Sultan PIK\bank-footage" --dry-run
 *   node scripts/catalog-bank/import-menu-location.mjs --dir "..." 
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const FIELD_ORDER = ["main", "topping", "garnish", "presentation", "sauce", "larangan", "khusus"];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function fail(message) {
  throw new Error(message);
}

function text(value, label, max) {
  if (typeof value !== "string") fail(`${label} harus teks`);
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} kosong`);
  if (value.length > max) fail(`${label} lebih dari ${max} karakter`);
  return value;
}

function optionalText(value, label, max) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") fail(`${label} harus teks`);
  if (value.length > max) fail(`${label} lebih dari ${max} karakter`);
  return value;
}

function slug(value, label) {
  const id = text(value, label, 80);
  if (!SLUG.test(id)) fail(`${label} bukan slug`);
  return id;
}

function labels(value, label, max) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${label} harus daftar`);
  return value.map((item, index) => text(item, `${label} ${index + 1}`, max));
}

function relativePath(value, label) {
  const file = text(value, label, 500);
  if (file.startsWith("/") || file.includes("\\") || file.includes("..")) fail(`${label} bukan path relatif`);
  return file.replace(/^\.?\//, "");
}

function orderedFields(fields) {
  const source = fields && typeof fields === "object" && !Array.isArray(fields) ? fields : {};
  const keys = Object.keys(source);
  const ordered = [
    ...FIELD_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !FIELD_ORDER.includes(key)),
  ];
  const rows = [];
  for (const key of ordered) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) fail(`field ${key} tidak valid`);
    const body = source[key];
    if (body == null || (typeof body === "string" && body.trim() === "")) continue;
    rows.push({ field_key: key, body: text(body, `field ${key}`, 4000) });
  }
  return rows.map((row, position) => ({ ...row, position }));
}

function readJson(file) {
  if (!fs.existsSync(file)) fail(`file tidak ada: ${path.basename(file)}`);
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) fail(`${path.basename(file)} harus berupa daftar`);
  return parsed;
}

function buildCatalog(dir) {
  const dataDir = path.join(path.resolve(dir), "_data");
  const menus = readJson(path.join(dataDir, "menu.json")).map((item, index) => {
    const externalId = slug(item.id, `menu ${index + 1} id`);
    return {
      external_id: externalId,
      name: text(item.nama, `menu ${externalId} nama`, 200),
      aliases: labels(item.alias, `menu ${externalId} alias`, 200),
      fields: orderedFields(item.fields),
      photos: (Array.isArray(item.fotos) ? item.fotos : []).map((photo, photoIndex) => ({
        file_path: relativePath(photo.file, `menu ${externalId} foto ${photoIndex + 1}`),
        label: text(photo.label, `menu ${externalId} label foto`, 500),
        ref: optionalText(photo.ref, `menu ${externalId} ref foto`, 2000),
        position: photoIndex,
      })),
    };
  });
  const locations = readJson(path.join(dataDir, "lokasi.json")).map((item, index) => {
    const externalId = slug(item.id, `lokasi ${index + 1} id`);
    const areaInfo = item.area_info && typeof item.area_info === "object" ? item.area_info : {};
    return {
      external_id: externalId,
      name: text(item.nama, `lokasi ${externalId} nama`, 200),
      photos: (Array.isArray(item.fotos) ? item.fotos : []).map((photo, photoIndex) => ({
        file_path: relativePath(photo.file, `lokasi ${externalId} foto ${photoIndex + 1}`),
        label: text(photo.label, `lokasi ${externalId} label foto`, 500),
        ref: optionalText(photo.ref, `lokasi ${externalId} ref foto`, 2000),
        description: optionalText(photo.desc, `lokasi ${externalId} deskripsi foto`, 4000),
        areas: labels(photo.area, `lokasi ${externalId} area foto`, 80),
        position: photoIndex,
      })),
      sections: (Array.isArray(item.bagian) ? item.bagian : []).map((section, sectionIndex) => ({
        title: text(section.judul, `lokasi ${externalId} bagian`, 200),
        body: typeof section.isi === "string" ? section.isi : fail(`lokasi ${externalId} isi bagian harus teks`),
        areas: labels(section.area, `lokasi ${externalId} area bagian`, 80),
        position: sectionIndex,
      })),
      areas: Object.keys(areaInfo).map((name, areaIndex) => ({
        name: text(name, `lokasi ${externalId} nama area`, 80),
        body: text(areaInfo[name], `lokasi ${externalId} isi area`, 4000),
        position: areaIndex,
      })),
    };
  });
  for (const rows of [menus, locations]) {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.external_id)) fail(`id dobel: ${row.external_id}`);
      seen.add(row.external_id);
    }
  }
  for (const section of locations.flatMap((location) => location.sections)) {
    if (section.body.length > 4000) fail(`bagian ${section.title} lebih dari 4000 karakter`);
  }
  return { menus, locations };
}

function report(catalog) {
  const waitingMenus = catalog.menus.filter((menu) => menu.fields.length === 0).length;
  console.log(`menu ${catalog.menus.length}`);
  console.log(`foto menu ${catalog.menus.reduce((sum, menu) => sum + menu.photos.length, 0)}`);
  console.log(`field menu ${catalog.menus.reduce((sum, menu) => sum + menu.fields.length, 0)}`);
  console.log(`menu menunggu ${waitingMenus}`);
  console.log(`lokasi ${catalog.locations.length}`);
  console.log(`foto lokasi ${catalog.locations.reduce((sum, location) => sum + location.photos.length, 0)}`);
  console.log(`bagian ${catalog.locations.reduce((sum, location) => sum + location.sections.length, 0)}`);
  console.log(`area ${catalog.locations.reduce((sum, location) => sum + location.areas.length, 0)}`);
}

function loadEnv() {
  const wanted = new Set(["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  for (const file of [".env", ".env.local", "services/mcp/.env", "supabase/.env"]) {
    const full = path.resolve(file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match || !wanted.has(match[1]) || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function replaceChildren(supabase, table, organizationId, parentColumn, parentIds) {
  if (parentIds.length === 0) return;
  await must(
    supabase.from(table).delete().eq("organization_id", organizationId).in(parentColumn, parentIds),
    `hapus ${table}`,
  );
}

async function dropMissing(supabase, table, organizationId, externalIds) {
  const existing = await must(
    supabase.from(table).select("id, external_id").eq("organization_id", organizationId),
    `baca ${table}`,
  );
  const keep = new Set(externalIds);
  const gone = existing.filter((row) => !keep.has(row.external_id)).map((row) => row.id);
  if (gone.length === 0) return;
  await must(
    supabase.from(table).delete().eq("organization_id", organizationId).in("id", gone),
    `hapus ${table} yang tidak ada di JSON`,
  );
}

async function applyMenus(supabase, organizationId, menus) {
  const saved = await must(
    supabase
      .from("catalog_menus")
      .upsert(
        menus.map((menu) => ({
          organization_id: organizationId,
          external_id: menu.external_id,
          name: menu.name,
          aliases: menu.aliases,
        })),
        { onConflict: "organization_id,external_id" },
      )
      .select("id, external_id"),
    "simpan menu",
  );
  const ids = new Map(saved.map((row) => [row.external_id, row.id]));
  await dropMissing(supabase, "catalog_menus", organizationId, menus.map((menu) => menu.external_id));
  const parentIds = [...ids.values()];
  await replaceChildren(supabase, "catalog_menu_fields", organizationId, "menu_id", parentIds);
  await replaceChildren(supabase, "catalog_menu_photos", organizationId, "menu_id", parentIds);
  const fields = menus.flatMap((menu) =>
    menu.fields.map((field) => ({
      organization_id: organizationId,
      menu_id: ids.get(menu.external_id),
      field_key: field.field_key,
      body: field.body,
      position: field.position,
    })),
  );
  const photos = menus.flatMap((menu) =>
    menu.photos.map((photo) => ({
      organization_id: organizationId,
      menu_id: ids.get(menu.external_id),
      file_path: photo.file_path,
      label: photo.label,
      ref: photo.ref,
      position: photo.position,
    })),
  );
  if (fields.length) await must(supabase.from("catalog_menu_fields").insert(fields), "simpan field menu");
  if (photos.length) await must(supabase.from("catalog_menu_photos").insert(photos), "simpan foto menu");
}

async function applyLocations(supabase, organizationId, locations) {
  const saved = await must(
    supabase
      .from("catalog_locations")
      .upsert(
        locations.map((location) => ({
          organization_id: organizationId,
          external_id: location.external_id,
          name: location.name,
        })),
        { onConflict: "organization_id,external_id" },
      )
      .select("id, external_id"),
    "simpan lokasi",
  );
  const ids = new Map(saved.map((row) => [row.external_id, row.id]));
  await dropMissing(supabase, "catalog_locations", organizationId, locations.map((location) => location.external_id));
  const parentIds = [...ids.values()];
  await replaceChildren(supabase, "catalog_location_photos", organizationId, "location_id", parentIds);
  await replaceChildren(supabase, "catalog_location_sections", organizationId, "location_id", parentIds);
  await replaceChildren(supabase, "catalog_location_areas", organizationId, "location_id", parentIds);
  const photos = locations.flatMap((location) =>
    location.photos.map((photo) => ({
      organization_id: organizationId,
      location_id: ids.get(location.external_id),
      file_path: photo.file_path,
      label: photo.label,
      ref: photo.ref,
      description: photo.description,
      areas: photo.areas,
      position: photo.position,
    })),
  );
  const sections = locations.flatMap((location) =>
    location.sections.map((section) => ({
      organization_id: organizationId,
      location_id: ids.get(location.external_id),
      title: section.title,
      body: section.body,
      areas: section.areas,
      position: section.position,
    })),
  );
  const areas = locations.flatMap((location) =>
    location.areas.map((area) => ({
      organization_id: organizationId,
      location_id: ids.get(location.external_id),
      name: area.name,
      body: area.body,
      position: area.position,
    })),
  );
  if (photos.length) await must(supabase.from("catalog_location_photos").insert(photos), "simpan foto lokasi");
  if (sections.length) await must(supabase.from("catalog_location_sections").insert(sections), "simpan bagian lokasi");
  if (areas.length) await must(supabase.from("catalog_location_areas").insert(areas), "simpan area lokasi");
}

async function main() {
  const dir = arg("--dir");
  if (!dir) {
    console.error("Butuh --dir ke folder bank-footage.");
    process.exit(2);
  }
  const organizationId = arg("--org") || DEFAULT_ORG;
  const catalog = buildCatalog(dir);
  report(catalog);
  if (process.argv.includes("--dry-run")) return;

  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.");
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await applyMenus(supabase, organizationId, catalog.menus);
  await applyLocations(supabase, organizationId, catalog.locations);
  console.log("impor selesai");
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun || process.argv[1]?.endsWith("import-menu-location.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "impor gagal");
    process.exit(1);
  });
}
