import { supabase, SUPABASE_URL } from "@/shared/lib/supabaseClient";

export const THINKING_JSON_PURPOSE = "thinking_json";

export const THINKING_JSON_SYSTEM =
  "Return JSON only. Do not write advertising scripts, captions, hashtags, Scene, Visual, VO, timing tables, or 15–60 second formats.";

export type ThinkingAiTemperature = 0 | 0.2;

export function buildThinkingAiRequestBody(
  prompt: string,
  temperature: ThinkingAiTemperature = 0,
): {
  prompt: string;
  purpose: typeof THINKING_JSON_PURPOSE;
  temperature: number;
} {
  return {
    prompt: prompt.trim(),
    purpose: THINKING_JSON_PURPOSE,
    temperature,
  };
}

export function thinkingPromptContainsScriptFormat(text: string): boolean {
  return (
    /\bVO \(Voice Over\)\b/i.test(text) ||
    /\b15[–-]60\s*second/i.test(text) ||
    /\bScene\s+\d/i.test(text) ||
    /\bVisual\s*:/i.test(text)
  );
}

export async function generateThinkingJsonWithAI(
  prompt: string,
  opts?: { temperature?: ThinkingAiTemperature },
): Promise<{ success: boolean; script?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: "Sesi login tidak valid. Silakan login ulang." };
    }
    const url = `${SUPABASE_URL}/functions/v1/generate-script-ai`;
    const body = buildThinkingAiRequestBody(prompt, opts?.temperature ?? 0);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (data === null || typeof data !== "object") {
      return { success: false, error: "Response server tidak valid. Coba lagi." };
    }
    if (!res.ok) {
      const errMsg = typeof (data as { error?: unknown }).error === "string"
        ? String((data as { error: string }).error)
        : `Request gagal (${res.status})`;
      return { success: false, error: errMsg };
    }
    const errMsg = (data as { error?: unknown }).error;
    if (errMsg) {
      return { success: false, error: typeof errMsg === "string" ? errMsg : "Failed to generate" };
    }
    const script = (data as { script?: unknown }).script;
    if (typeof script !== "string") {
      return { success: false, error: "No content generated from AI" };
    }
    return { success: true, script: script.trim() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
