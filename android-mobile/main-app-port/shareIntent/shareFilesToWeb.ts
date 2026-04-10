import { Capacitor } from "@capacitor/core";
/** Build web `File` objects from native absolute paths copied into app cache. */
export async function shareIntentFilesToFiles(
  items: Array<{ path: string; name: string; mimeType: string }>,
): Promise<File[]> {
  const out: File[] = [];
  for (const item of items) {
    const url = Capacitor.convertFileSrc(item.path);
    const res = await fetch(url);
    const blob = await res.blob();
    const mime = item.mimeType || blob.type || "application/octet-stream";
    const name = item.name || "receipt";
    out.push(new File([blob], name, { type: mime }));
  }
  return out;
}
