import { supabase } from "@/shared/lib/supabaseClient";
import { CATALOG_MEDIA_BUCKET } from "../shared/catalogQuery";
import { LOCATION_ALWAYS_ON, LOCATION_TEXT_MAX } from "../../../supabase/functions/_shared/describeCatalogLocation";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSION: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function locationPhotoExtension(type: string): "jpg" | "png" | "webp" | null {
  return MIME_EXTENSION[type] ?? null;
}

export function locationPhotoError(file: { type: string; size: number }): string | null {
  if (!locationPhotoExtension(file.type)) return "Pakai foto JPEG, PNG, atau WebP.";
  if (file.size > MAX_BYTES) return "Foto paling besar 5 MB.";
  return null;
}

/** Laptop-relative stand-in. The bytes live in storage, not in the catalog bank. */
export function locationPhotoFilePath(photoId: string, extension: string): string {
  return `unggah/${photoId}.${extension}`;
}

/** Matches catalog_location_photos_storage_path_check: {org}/photos/{id}.ext */
export function locationPhotoObjectPath(organizationId: string, photoId: string, extension: string): string {
  return `${organizationId}/photos/${photoId}.${extension}`;
}

export function nextPhotoPosition(photos: Array<{ position?: number }>): number {
  let max = -1;
  for (const photo of photos) {
    if (typeof photo.position === "number" && photo.position > max) max = photo.position;
  }
  return max + 1;
}

export function locationPhotoLabel(name: string): string {
  const label = name.trim().slice(0, 500);
  return label || "Foto";
}

export interface LocationSectionRowPlan {
  id: string;
  title: string;
  position: number;
}

/** Updates the three always-on sections in place. Any other title is left alone. */
export function planLocationSections(
  existing: LocationSectionRowPlan[],
  incoming: { title: string; body: string }[],
): {
  updates: { id: string; body: string }[];
  inserts: { title: string; body: string; position: number }[];
} {
  const allowed = new Set(LOCATION_ALWAYS_ON.map((section) => section.title));
  const updates: { id: string; body: string }[] = [];
  const inserts: { title: string; body: string; position: number }[] = [];
  let next = existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const seen = new Set<string>();
  for (const row of incoming) {
    if (!allowed.has(row.title) || seen.has(row.title)) continue;
    seen.add(row.title);
    const body = row.body.trim().slice(0, LOCATION_TEXT_MAX);
    const matches = existing.filter((item) => item.title === row.title);
    if (matches.length) {
      for (const match of matches) updates.push({ id: match.id, body });
      continue;
    }
    if (!body) continue;
    inserts.push({ title: row.title, body, position: next });
    next += 1;
  }
  return { updates, inserts };
}

export interface LocationPhotoInsert {
  id: string;
  organization_id: string;
  location_id: string;
  file_path: string;
  label: string;
  areas: string[];
  position: number;
}

export interface LocationPhotoStore {
  insertPhoto: (row: LocationPhotoInsert) => Promise<void>;
  uploadObject: (path: string, file: Blob, contentType: string) => Promise<void>;
  saveStoragePath: (id: string, path: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  deleteObject: (path: string) => Promise<void>;
}

/** Inserts the row, uploads the bytes, then stores the object path. A failed upload removes the new row. */
export async function storeLocationPhoto(
  db: LocationPhotoStore,
  input: {
    organizationId: string;
    locationId: string;
    label: string;
    position: number;
    file: { type: string; size: number; blob: Blob };
    id?: string;
  },
): Promise<string> {
  const invalid = locationPhotoError(input.file);
  if (invalid) throw new Error(invalid);
  const extension = locationPhotoExtension(input.file.type);
  if (!extension) throw new Error("Pakai foto JPEG, PNG, atau WebP.");
  const id = input.id ?? crypto.randomUUID();
  const storagePath = locationPhotoObjectPath(input.organizationId, id, extension);
  await db.insertPhoto({
    id,
    organization_id: input.organizationId,
    location_id: input.locationId,
    file_path: locationPhotoFilePath(id, extension),
    label: locationPhotoLabel(input.label),
    areas: [],
    position: input.position,
  });
  try {
    await db.uploadObject(storagePath, input.file.blob, input.file.type === "image/jpg" ? "image/jpeg" : input.file.type);
  } catch (error) {
    await db.deletePhoto(id);
    throw error;
  }
  try {
    await db.saveStoragePath(id, storagePath);
  } catch (error) {
    await db.deleteObject(storagePath);
    await db.deletePhoto(id);
    throw error;
  }
  return id;
}

export async function addLocationPhoto(input: {
  organizationId: string;
  locationId: string;
  label: string;
  position: number;
  file: File;
}): Promise<string> {
  return storeLocationPhoto(
    {
      insertPhoto: async (row) => {
        const { error } = await supabase.from("catalog_location_photos").insert(row);
        if (error) throw error;
      },
      uploadObject: async (path, file, contentType) => {
        const { error } = await supabase.storage.from(CATALOG_MEDIA_BUCKET).upload(path, file, {
          upsert: true,
          contentType,
        });
        if (error) throw error;
      },
      saveStoragePath: async (id, path) => {
        const { error } = await supabase
          .from("catalog_location_photos")
          .update({ storage_path: path })
          .eq("id", id)
          .eq("organization_id", input.organizationId);
        if (error) throw error;
      },
      deletePhoto: async (id) => {
        await supabase.from("catalog_location_photos").delete().eq("id", id).eq("organization_id", input.organizationId);
      },
      deleteObject: async (path) => {
        await supabase.storage.from(CATALOG_MEDIA_BUCKET).remove([path]);
      },
    },
    { ...input, file: { type: input.file.type, size: input.file.size, blob: input.file } },
  );
}

export async function writeLocationCopy(
  organizationId: string,
  locationId: string,
  photos: { id: string; description: string }[],
  sections: { title: string; body: string }[],
): Promise<void> {
  for (const photo of photos) {
    const description = photo.description.trim().slice(0, LOCATION_TEXT_MAX);
    const { error } = await supabase
      .from("catalog_location_photos")
      .update({ description: description || null })
      .eq("organization_id", organizationId)
      .eq("location_id", locationId)
      .eq("id", photo.id);
    if (error) throw error;
  }
  const { data, error } = await supabase
    .from("catalog_location_sections")
    .select("id,title,position")
    .eq("organization_id", organizationId)
    .eq("location_id", locationId);
  if (error) throw error;
  const plan = planLocationSections((data ?? []) as LocationSectionRowPlan[], sections);
  for (const row of plan.updates) {
    const { error: updateError } = await supabase
      .from("catalog_location_sections")
      .update({ body: row.body })
      .eq("organization_id", organizationId)
      .eq("location_id", locationId)
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
  for (const row of plan.inserts) {
    const { error: insertError } = await supabase.from("catalog_location_sections").insert({
      organization_id: organizationId,
      location_id: locationId,
      title: row.title,
      body: row.body,
      areas: [],
      position: row.position,
    });
    if (insertError) throw insertError;
  }
}
