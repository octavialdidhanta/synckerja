import { supabase } from "@/shared/lib/supabaseClient";
import { presentGeminiSpendCap, readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";

/** Ask Gemini for a location draft. The caller shows it in the form; this does not save. */
export async function describeCatalogLocation(photoId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("describe-catalog-location", { body: { photo_id: photoId } });
  const message = await readEdgeFunctionError(data, error);
  if (message) {
    presentGeminiSpendCap(message);
    if (message === "no_photo") throw new Error("Foto belum di-upload.");
    throw new Error(message);
  }
  const fields = data && typeof data === "object" && "fields" in data ? data.fields : null;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("Gemini tidak mengembalikan draf.");
  const draft: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value.trim()) continue;
    draft[key] = value.trim();
  }
  if (Object.keys(draft).length === 0) throw new Error("Gemini tidak mengembalikan draf.");
  return draft;
}
