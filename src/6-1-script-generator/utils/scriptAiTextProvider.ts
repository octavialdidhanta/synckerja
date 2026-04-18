import type { ScriptAIConfigRow } from '@/6-1-script-generator/hooks/useScriptAIConfig';

export type TextAIProvider = 'gemini' | 'groq' | 'fireworks';

export function resolveTextAIProvider(
  row: Pick<ScriptAIConfigRow, 'text_ai_provider' | 'is_active'> | null | undefined
): TextAIProvider {
  if (!row) return 'gemini';
  const p = row.text_ai_provider;
  if (p === 'gemini' || p === 'groq' || p === 'fireworks') return p;
  return row.is_active ? 'groq' : 'gemini';
}

export function defaultModelForTextAIProvider(provider: TextAIProvider): string {
  if (provider === 'groq') return 'llama-3.3-70b-versatile';
  if (provider === 'fireworks') return 'fireworks/llama-v3p3-70b-instruct';
  return 'gemini-2.5-flash';
}

export function isTextAIConfigured(
  row: Pick<ScriptAIConfigRow, 'text_ai_provider' | 'is_active' | 'api_key_configured'> | null | undefined
): boolean {
  if (!row) return false;
  const provider = resolveTextAIProvider(row);
  if (provider === 'gemini') return !!row.api_key_configured;
  return true;
}

export function textAIProviderLabel(provider: TextAIProvider): string {
  if (provider === 'groq') return 'Groq';
  if (provider === 'fireworks') return 'Fireworks';
  return 'Gemini';
}
