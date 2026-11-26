/**
 * A storyboard vo cell that only marks "no voice over here" — natural sound, a pause, a tasting shot — instead of
 * words to speak. Examples: "(suara asli)", "(natural sound)", "-", "—", "[pause]", "(SFX sruput)".
 * ElevenLabs delivery tags such as "[matter-of-fact]" are ignored first, so "[matter-of-fact](suara asli)" also counts.
 * Such a row never gets a generated clip (it would read the marker aloud) and becomes silence in render.jobs.draft.
 */
export function isNoVoMarker(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) return true;
  // Whole cell is one bracketed note: (…) or […] — checked before tags are removed so "[pause]" counts.
  if (/^\([^()]*\)$/.test(raw) || /^\[[^[\]]*\]$/.test(raw)) return true;
  const withoutTags = raw.replace(/\[[^\]]*\]/g, "").trim();
  if (!withoutTags) return true;
  if (/^\([^()]*\)$/.test(withoutTags)) return true;
  // Only dashes, dots or similar filler.
  if (/^[-–—_.·…\s]+$/.test(withoutTags)) return true;
  return /^(tanpa vo|no vo|suara asli|natural sound|nat sound|sfx|silence|hening)\.?$/i.test(withoutTags);
}

/** Seconds of a storyboard timing cell like "16–18" or "16-18s"; null when it is not a range. */
export function timingSeconds(timing: string | null | undefined): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*(?:s|dtk|detik)?\s*$/i.exec(timing ?? "");
  if (!m) return null;
  const a = Number(m[1]!.replace(",", "."));
  const b = Number(m[2]!.replace(",", "."));
  const d = b - a;
  return d > 0 && d <= 30 ? Math.round(d * 100) / 100 : null;
}
