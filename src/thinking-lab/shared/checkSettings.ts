// Per-organization switches for every Thinking Lab pass check.
// Stored as {"<level>.<checkId>": true}; a missing key is OFF, so every check starts OFF.
// Relative imports only: the MCP server loads this file.
import { LEGACY_IDEA_SWITCHES } from "../idea/check/ids";
import { LEGACY_ANGLE_SWITCHES } from "../angle/passChecklist";

export type CheckLevel = "master" | "bigThought" | "territory" | "angle" | "idea";

export type CheckSettings = Readonly<Record<string, boolean>>;

type CheckEntry = { id: string; id_label: string; en_label: string };

export const CHECK_REGISTRY: Readonly<Record<CheckLevel, readonly CheckEntry[]>> = {
  master: [
    { id: "singleClaim", id_label: "Satu klaim, satu kalimat", en_label: "One claim, one sentence" },
    { id: "noPromoOrBrand", id_label: "Bukan promosi atau merek", en_label: "No promotion or brand" },
    { id: "subjectClear", id_label: "Subjek jelas", en_label: "Clear subject" },
    { id: "shift", id_label: "Menggeser keyakinan lama", en_label: "Shifts the prior belief" },
    { id: "accountable", id_label: "Bisa dipertanggungjawabkan", en_label: "Defensible claim" },
  ],
  bigThought: [
    { id: "resolved", id_label: "Menjawab Master Thought", en_label: "Answers the Master Thought" },
    { id: "relation", id_label: "Hubungan sebab yang jelas", en_label: "Clear cause relation" },
    { id: "explains", id_label: "Benar-benar menjelaskan", en_label: "Really explains" },
    { id: "premise", id_label: "Premis bisa diterima", en_label: "Acceptable premise" },
    { id: "showable", id_label: "Bisa ditunjukkan", en_label: "Can be shown" },
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
    { id: "observation", id_label: "Observasi", en_label: "Observation" },
    { id: "rightSize", id_label: "Ukurannya pas", en_label: "Right size" },
    { id: "ownSubject", id_label: "Subjek sendiri", en_label: "Own subject" },
    { id: "livedExample", id_label: "Contoh nyata", en_label: "Lived example" },
    { id: "siblingsDistinct", id_label: "Beda dari Angle lain", en_label: "Distinct from other Angles" },
  ],
  idea: [
    { id: "proposal", id_label: "Satu usulan, bentuk kalimat Idea", en_label: "One proposal in the Idea form" },
    { id: "mechanism", id_label: "Mekanisme jelas", en_label: "Clear mechanism" },
    { id: "result", id_label: "Hasilnya terjadi di situasi", en_label: "The result happens in the situation" },
    { id: "stakeHolds", id_label: "Taruhannya kena", en_label: "The stake holds" },
    { id: "causeLock", id_label: "Penyebab terkunci", en_label: "Cause is locked" },
    { id: "watchable", id_label: "Bisa ditonton atau diikuti", en_label: "Audience can watch or join" },
    { id: "distinct", id_label: "Beda dari Idea lain", en_label: "Distinct from other Ideas" },
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

/** The checks of one level that are switched OFF: skipped, and recorded on the saved item. */
export function skippedChecks(settings: CheckSettings | null | undefined, level: CheckLevel): string[] {
  return CHECK_REGISTRY[level].filter((entry) => !checkEnabled(settings, level, entry.id)).map((entry) => entry.id);
}

/** Only switches that exist. An Idea or Angle switch saved before its checks were merged turns on the check that replaced it. */
export function parseCheckSettings(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const on = new Set(
    Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key),
  );
  const out: Record<string, boolean> = {};
  for (const level of CHECK_LEVELS) {
    for (const entry of CHECK_REGISTRY[level]) {
      const key = checkKey(level, entry.id);
      const replaced =
        level === "idea"
          ? (LEGACY_IDEA_SWITCHES[entry.id as keyof typeof LEGACY_IDEA_SWITCHES] ?? [])
          : level === "angle"
            ? (LEGACY_ANGLE_SWITCHES[entry.id as keyof typeof LEGACY_ANGLE_SWITCHES] ?? [])
            : [];
      if (on.has(key) || replaced.some((id) => on.has(checkKey(level, id)))) out[key] = true;
    }
  }
  return out;
}
