import {
  generateThinkingJsonWithAI,
  type ThinkingAiTemperature,
} from "@/thinking-lab/shared/thinkingAiClient";

export async function askThinkingLab(
  prompt: string,
  temperature: ThinkingAiTemperature = 0,
): Promise<string | null> {
  const result = await generateThinkingJsonWithAI(prompt, { temperature });
  if (!result.success || !result.script?.trim()) return null;
  return result.script.trim();
}

function relaxModelJson(source: string): string {
  return source.replace(/,\s*""\s*(?=[}\]])/g, "").replace(/,\s*([}\]])/g, "$1");
}

export function parseModelJson(script: string): unknown | null {
  const trimmed = script.trim();
  const objectAt = trimmed.indexOf("{");
  const arrayAt = trimmed.indexOf("[");
  const start =
    objectAt < 0 ? arrayAt : arrayAt < 0 ? objectAt : Math.min(objectAt, arrayAt);
  if (start < 0) return null;
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (end < start) return null;
  const slice = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    try {
      return JSON.parse(relaxModelJson(slice)) as unknown;
    } catch {
      return null;
    }
  }
}
