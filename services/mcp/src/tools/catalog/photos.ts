import type { McpAuthContext } from "../../authz/context";
import type { CatalogAddress, CatalogPhotoSet, CatalogPhotoSource } from "../../db/catalog";
import type { McpContentBlock, McpContentResult } from "../footage/view";
import { getCatalogProductInput } from "./products";

/**
 * catalog.product.photo.view and catalog.location.photos.view: the stored photos as images the AI can look at, so it
 * can write product or location descriptions without opening a signed URL (which some clients cannot reach).
 */
export const PHOTO_VIEW_MAX = 8;

export const viewCatalogProductPhotoInput = getCatalogProductInput;
export const viewCatalogLocationPhotosInput = getCatalogProductInput;

type LoadPhotos = (ctx: McpAuthContext, address: CatalogAddress) => Promise<CatalogPhotoSet>;
type DownloadPhoto = (ctx: McpAuthContext, bucket: string, path: string) => Promise<Uint8Array>;

/** The image type from the first bytes, or null for anything that is not a picture MCP clients can show. */
export function imageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const KIND_LABEL: Record<CatalogPhotoSource["kind"], string> = {
  look_item: "foto tampilan (Item Library)",
  look_subcategory: "foto tampilan (subkategori)",
  reference: "foto referensi",
  location: "foto lokasi",
};

function photoLabel(n: number, source: CatalogPhotoSource): string {
  const parts = [`${n}. ${source.label || "(tanpa label)"} [${KIND_LABEL[source.kind]}]`];
  if (source.file_path) parts.push(`file: ${source.file_path}`);
  if (source.areas && source.areas.length > 0) parts.push(`area: ${source.areas.join(", ")}`);
  if (source.kind === "location") parts.push(`deskripsi sekarang: ${source.description?.trim() ? source.description.trim() : "(kosong)"}`);
  return parts.join(" | ");
}

async function photoResult(
  ctx: McpAuthContext,
  args: unknown,
  load: LoadPhotos,
  download: DownloadPhoto,
  subject: "product" | "location",
): Promise<McpContentResult> {
  const parsed = getCatalogProductInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const set = await load(ctx, { id: parsed.data.id, name: parsed.data.name });
  const picked = set.sources.slice(0, PHOTO_VIEW_MAX);

  const images = await Promise.all(
    picked.map(async (source) => {
      try {
        const bytes = await download(ctx, source.bucket, source.path);
        const mimeType = imageMimeType(bytes);
        return mimeType ? { data: Buffer.from(bytes).toString("base64"), mimeType, problem: null } : { problem: "bukan gambar" };
      } catch (error) {
        const reason = error instanceof Error && error.message === "too_large" ? "file terlalu besar" : "tidak bisa dibuka";
        return { problem: reason };
      }
    }),
  );

  const shown = images.filter((image) => !image.problem).length;
  const header = {
    [subject]: set.name,
    id: set.id,
    photos: set.sources.length,
    with_image: shown,
    truncated: set.sources.length > picked.length,
    not_uploaded: set.without_file,
    note:
      shown > 0
        ? subject === "product"
          ? "These are the product's stored photos, numbered like the labels below. Describe only what is visible in them. When the first is the appearance photo (foto tampilan), it is the one picture the product must look like."
          : "These are the location's stored photos, numbered like the labels below. Describe only what is visible in them."
        : "No photo could be shown. Do not invent how it looks; ask the user for a photo.",
  };
  const content: McpContentBlock[] = [{ type: "text", text: JSON.stringify(header) }];
  picked.forEach((source, index) => {
    const image = images[index]!;
    const label = photoLabel(index + 1, source);
    if (image.problem || !("data" in image)) {
      content.push({ type: "text", text: `${label} (${image.problem})` });
      return;
    }
    content.push({ type: "text", text: label });
    content.push({ type: "image", data: image.data!, mimeType: image.mimeType! });
  });
  return { mcpContent: content };
}

export function viewCatalogProductPhotoResult(
  ctx: McpAuthContext,
  args: unknown,
  load: LoadPhotos,
  download: DownloadPhoto,
): Promise<McpContentResult> {
  return photoResult(ctx, args, load, download, "product");
}

export function viewCatalogLocationPhotosResult(
  ctx: McpAuthContext,
  args: unknown,
  load: LoadPhotos,
  download: DownloadPhoto,
): Promise<McpContentResult> {
  return photoResult(ctx, args, load, download, "location");
}
