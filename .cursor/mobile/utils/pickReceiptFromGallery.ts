import { Capacitor } from "@capacitor/core";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { PhotoPicker } from "@/plugins/photo-picker";
import { shareIntentFilesToFiles } from "@/mobile/shareIntent/shareFilesToWeb";

/**
 * Gallery/receipt images without READ_MEDIA_* on Android (system Photo Picker).
 * iOS and web keep using Capacitor Camera (Photos).
 */
export async function pickReceiptImageFiles(options?: {
  maxItems?: number;
  mediaType?: "imageOnly" | "imageAndVideo";
}): Promise<File[]> {
  const maxItems = options?.maxItems ?? 10;
  const mediaType = options?.mediaType ?? "imageOnly";

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const { files } = await PhotoPicker.pickMedia({ maxItems, mediaType });
    if (!files.length) return [];
    return shareIntentFilesToFiles(files);
  }

  const photo = await CapacitorCamera.getPhoto({
    source: CameraSource.Photos,
    resultType: CameraResultType.Uri,
    quality: 85,
  });
  if (!photo.webPath) return [];

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const mimeType = (blob.type || photo.format || "image/jpeg").toLowerCase();
  const extension = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const file = new File([blob], `receipt_${Date.now()}.${extension}`, { type: mimeType });
  return [file];
}
