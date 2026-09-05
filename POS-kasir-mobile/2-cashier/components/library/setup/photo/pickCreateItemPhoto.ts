import { Capacitor } from "@capacitor/core";
import { pickStoryboardNativePhoto } from "@/6-1-dashboard/lib/pickStoryboardImage";

const ACCEPT = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function isAcceptedCreateItemPhoto(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (ACCEPT.has(type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

/**
 * Native: Capacitor Camera / Photos.
 * Web: returns null — caller should trigger hidden file / capture input.
 */
export async function pickCreateItemNativePhoto(
  source: "camera" | "gallery",
): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const files = await pickStoryboardNativePhoto(source);
  const file = files[0];
  if (!file || !isAcceptedCreateItemPhoto(file)) return null;
  return file;
}

export function readFileAsObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}
