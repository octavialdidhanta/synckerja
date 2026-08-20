import { supabase } from "@/shared/lib/supabaseClient";
import { CATALOG_PRODUCT_PHOTOS_BUCKET } from "@/8-2-1-default-prices/lib/catalogProductPhoto";

export function catalogIngredientPhotoObjectPath(
  organizationId: string,
  ingredientId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "photo.jpg";
  return `${organizationId}/ingredients/${ingredientId}/${safe}`;
}

export async function uploadCatalogIngredientPhoto(args: {
  organizationId: string;
  ingredientId: string;
  file: File;
}): Promise<string> {
  const path = catalogIngredientPhotoObjectPath(
    args.organizationId,
    args.ingredientId,
    args.file.name,
  );
  const { error } = await supabase.storage.from(CATALOG_PRODUCT_PHOTOS_BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}
