// Per-organization switches for every Thinking Lab pass check.
// Stored as {"<level>.<checkId>": true}; a missing key is OFF, so every check starts OFF.
// Relative imports only: the MCP server loads this file.

export type CheckLevel = "master" | "bigThought" | "territory" | "angle" | "idea";

export type CheckSettings = Readonly<Record<string, boolean>>;

type CheckEntry = { id: string; id_label: string; en_label: string };

export const CHECK_REGISTRY: Readonly<Record<CheckLevel, readonly CheckEntry[]>> = {
  master: [
    { id: "oneClaim", id_label: "Satu klaim saja", en_label: "One claim only" },
    { id: "oneSentence", id_label: "Satu kalimat", en_label: "One sentence" },
    { id: "notPromo", id_label: "Bukan promosi", en_label: "Not a promotion" },
    { id: "shift", id_label: "Menggeser keyakinan lama", en_label: "Shifts the prior belief" },
  ],
  bigThought: [
    { id: "resolved", id_label: "Menjawab Master Thought", en_label: "Answers the Master Thought" },
    { id: "relation", id_label: "Hubungan sebab yang jelas", en_label: "Clear cause relation" },
    { id: "role", id_label: "Peran yang jelas", en_label: "Clear role" },
    { id: "explains", id_label: "Benar-benar menjelaskan", en_label: "Really explains" },
    { id: "premise", id_label: "Premis bisa diterima", en_label: "Acceptable premise" },
    { id: "duplicate", id_label: "Bukan duplikat", en_label: "Not a duplicate" },
    { id: "sibling", id_label: "Beda dari BT lain", en_label: "Distinct from other BTs" },
  ],
  territory: [
    { id: "partOfBigThought", id_label: "Bagian dari Big Thought", en_label: "Part of the Big Thought" },
    { id: "audienceLanguage", id_label: "Bahasa audiens", en_label: "Audience language" },
    { id: "questionArises", id_label: "Memunculkan pertanyaan BT", en_label: "Raises the BT's question" },
    { id: "wideEnough", id_label: "Cukup luas", en_label: "Wide enough" },
    { id: "siblingsDistinct", id_label: "Beda dari Territory lain", en_label: "Distinct from other Territories" },
  ],
  angle: [
    { id: "stakeHolds", id_label: "Taruhannya kena", en_label: "The stake holds" },
    { id: "observationShape", id_label: "Bentuk observasi", en_label: "Observation shape" },
    { id: "severalIdeas", id_label: "Bisa jadi beberapa Idea", en_label: "Room for several Ideas" },
    { id: "clearBoundary", id_label: "Batas yang jelas", en_label: "Clear boundary" },
    { id: "observationJob", id_label: "Observasi menjalankan tugasnya", en_label: "Observation does its job" },
    { id: "ownSubject", id_label: "Subjek sendiri", en_label: "Own subject" },
    { id: "livedExample", id_label: "Contoh nyata", en_label: "Lived example" },
    { id: "siblingsDistinct", id_label: "Beda dari Angle lain", en_label: "Distinct from other Angles" },
  ],
  idea: [
    { id: "sentenceForm", id_label: "Bentuk kalimat Idea", en_label: "Idea sentence form" },
    { id: "stakeHolds", id_label: "Taruhannya kena", en_label: "The stake holds" },
    { id: "mechanismShape", id_label: "Bentuk mekanisme", en_label: "Mechanism shape" },
    { id: "vehicle", id_label: "Kendaraan yang jelas", en_label: "Clear vehicle" },
    { id: "recognizable", id_label: "Mudah dikenali", en_label: "Recognizable" },
    { id: "situationFelt", id_label: "Situasinya terasa", en_label: "Situation is felt" },
    { id: "causeLock", id_label: "Penyebab terkunci", en_label: "Cause is locked" },
    { id: "siblingsDistinct", id_label: "Beda dari Idea lain", en_label: "Distinct from other Ideas" },
    { id: "K1", id_label: "K1 · Satu usulan spesifik", en_label: "K1 · One specific proposal" },
    { id: "K2", id_label: "K2 · (dipensiunkan)", en_label: "K2 · (retired)" },
    { id: "K3", id_label: "K3 · Mekanisme menghasilkan nilai", en_label: "K3 · Mechanism produces the value" },
    { id: "K4", id_label: "K4 · Nilai yang konkret", en_label: "K4 · Concrete value" },
    { id: "K5", id_label: "K5 · Beda dari Idea lain", en_label: "K5 · Different from other Ideas" },
    { id: "K6", id_label: "K6 · Terhubung ke MT, BT, Territory", en_label: "K6 · Linked to MT, BT, Territory" },
    { id: "K7", id_label: "K7 · Bisa ditonton atau diikuti", en_label: "K7 · Audience can watch or join" },
  ],
};

export const CHECK_LEVELS: readonly CheckLevel[] = ["master", "bigThought", "territory", "angle", "idea"];

export function checkKey(level: CheckLevel, id: string): string {
  return `${level}.${id}`;
}

/** OFF unless the organization switched it on. */
export function checkEnabled(settings: CheckSettings | null | undefined, level: CheckLevel, id: string): boolean {
  return settings?.[checkKey(level, id)] === true;
}

/** True when every check of the level is OFF: the level saves without any model check. */
export function levelChecksOff(settings: CheckSettings | null | undefined, level: CheckLevel): boolean {
  return CHECK_REGISTRY[level].every((entry) => !checkEnabled(settings, level, entry.id));
}

export function enabledChecks(settings: CheckSettings | null | undefined, level: CheckLevel): string[] {
  return CHECK_REGISTRY[level].filter((entry) => checkEnabled(settings, level, entry.id)).map((entry) => entry.id);
}

export function parseCheckSettings(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, on] of Object.entries(value as Record<string, unknown>)) {
    if (on === true && /^(master|bigThought|territory|angle|idea)\.[A-Za-z0-9]{1,40}$/.test(key)) out[key] = true;
  }
  return out;
}

/** Marker stored on an item saved while some of its level's checks were OFF. */
export const UNCHECKED_MARKER = "UNCHECKED";
