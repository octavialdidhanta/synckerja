export const VOICE_TTS_MODELS = [
  { id: "eleven_v4", label: "Eleven v4" },
  { id: "eleven_v3", label: "Eleven v3" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5" },
] as const;

export const VOICE_LANGUAGES = [
  { id: "id", fallback: "Indonesian" },
  { id: "en", fallback: "English" },
  { id: "ms", fallback: "Malay" },
  { id: "ja", fallback: "Japanese" },
  { id: "zh", fallback: "Chinese" },
  { id: "ar", fallback: "Arabic" },
  { id: "ko", fallback: "Korean" },
  { id: "th", fallback: "Thai" },
  { id: "vi", fallback: "Vietnamese" },
  { id: "hi", fallback: "Hindi" },
  { id: "es", fallback: "Spanish" },
  { id: "pt", fallback: "Portuguese" },
  { id: "fr", fallback: "French" },
  { id: "de", fallback: "German" },
] as const;

export function voiceModelUsesSpeed(model: string) {
  return model !== "eleven_v4" && model !== "eleven_v3";
}

export function voiceModelUsesLanguage(model: string) {
  return model !== "eleven_multilingual_v2";
}

export function voiceModelLabel(model: string) {
  return VOICE_TTS_MODELS.find((item) => item.id === model)?.label ?? model;
}

/** STS always uses this ElevenLabs voice-changer model (not the org TTS model). */
export const VOICE_STS_MODEL_ID = "eleven_multilingual_sts_v2";
export const VOICE_STS_MODEL_LABEL = "Speech to speech · Multilingual v2";
