import { GeminiPrepaidDepletedError, GeminiSpendCapError, isGeminiPrepaidDepletedMessage, isGeminiSpendCapMessage } from "@/shared/ai/geminiSpendCap";
import {
  generateThinkingJsonWithAI,
  setThinkingAuditScope,
  type ThinkingAiTemperature,
  type ThinkingAuditScope,
} from "@/thinking-lab/shared/thinkingAiClient";

export { setThinkingAuditScope };
export type { ThinkingAuditScope };

export async function askThinkingLab(
  prompt: string,
  temperature: ThinkingAiTemperature = 0,
): Promise<string | null> {
  const result = await generateThinkingJsonWithAI(prompt, { temperature });
  if (isGeminiSpendCapMessage(result.error)) {
    throw new GeminiSpendCapError(result.error);
  }
  if (isGeminiPrepaidDepletedMessage(result.error)) {
    throw new GeminiPrepaidDepletedError(result.error);
  }
  if (!result.success || !result.script?.trim()) return null;
  return result.script.trim();
}

export { parseModelJson } from "@/thinking-lab/shared/parseModelJson";
