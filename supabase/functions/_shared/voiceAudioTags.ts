const BLOCKED_TAG = /\b(gunshot|applause|explosion|music|coughing|singing|yawning|panting|gasping|sniffling|clears throat|laughing|sighing)\b/i;

export function voiceModelSupportsAudioTags(model: string) {
  return model === "eleven_v4" || model === "eleven_v3";
}

const LANGUAGE_ACCENT: Record<string, string> = {
  id: "[strong Indonesian accent]",
  ms: "[strong Malay accent]",
};

/** Eleven v4 keeps the reference accent when Indonesian and Malay look alike. Name the accent in the request only. */
export function withLanguageAccent(model: string, language: string, text: string): string {
  if (!voiceModelSupportsAudioTags(model)) return text;
  const directive = LANGUAGE_ACCENT[language.trim().toLowerCase()];
  if (!directive) return text;
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase().includes(directive.toLowerCase())) return trimmed;
  return `${directive} ${trimmed}`;
}

export function autoTagPrompt(narration: string) {
  return [
    "Add ElevenLabs audio tags to this voice-over.",
    "Return only the tagged narration. No explanation.",
    "Do not add, remove, or rewrite any spoken word.",
    "Keep the original punctuation.",
    "Add one or two English tags in square brackets, placed immediately before the phrase they affect.",
    "Use only emotion or delivery tags, such as [playful], [curious], [warm], [confident], [conversational], [gently], or [matter-of-fact].",
    "Do not add coughing, singing, laughing, sighing, sound effects, music, or physical actions.",
    "The spoken words may be Indonesian. Copy every spoken word exactly.",
    "",
    "Narration:",
    narration,
  ].join("\n");
}

export function cleanModelText(raw: string) {
  let text = raw.trim();
  const fence = text.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence?.[1]) text = fence[1].trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

export function spokenKey(text: string) {
  return text
    .replace(/\[[^\]\n]{0,80}\]/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function narrationWithoutTags(text: string) {
  return text.replace(/\s*\[[^\]\n]{0,80}\]\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

export function hasVoiceExpression(text: string) {
  return /\[[^\]\n]{1,80}\]/.test(text);
}

export async function resolveTaggedNarration(
  original: string,
  ask: (prompt: string) => Promise<{ text: string; tokens?: number | null } | { error: string }>,
): Promise<{ text: string; tokens: number | null } | { error: string }> {
  let tokens = 0;
  let sawTokens = false;
  const note = (raw: { text: string; tokens?: number | null }) => {
    if (typeof raw.tokens === "number") {
      tokens += raw.tokens;
      sawTokens = true;
    }
  };
  let raw = await ask(autoTagPrompt(original));
  if ("error" in raw) return raw;
  note(raw);
  let accepted = acceptTaggedNarration(original, raw.text);
  if (!accepted.ok) {
    raw = await ask(`${autoTagPrompt(original)}\n\nThe previous answer was rejected because it changed the words or used a forbidden tag. Return the original words exactly, with one allowed tag.`);
    if ("error" in raw) return raw;
    note(raw);
    accepted = acceptTaggedNarration(original, raw.text);
  }
  if (!accepted.ok) return { error: "Auto-tag mengubah kata narasi. Generate dibatalkan agar teks yang diucapkan tetap sama." };
  return { text: accepted.text, tokens: sawTokens ? tokens : null };
}

export function acceptTaggedNarration(original: string, raw: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = cleanModelText(raw);
  if (!text) return { ok: false, reason: "empty" };
  const tags = text.match(/\[[^\]\n]{0,80}\]/g) ?? [];
  if (tags.length === 0) return { ok: false, reason: "no-tag" };
  if (tags.length > 3) return { ok: false, reason: "too-many" };
  if (tags.some((tag) => BLOCKED_TAG.test(tag))) return { ok: false, reason: "blocked" };
  if (spokenKey(original) !== spokenKey(text)) return { ok: false, reason: "words-changed" };
  return { ok: true, text };
}
