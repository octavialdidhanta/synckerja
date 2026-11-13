// What each level of the Thinking Lab chain is, the shape it is written in, and the exact rule of every
// pass check, read from the same code the checks run. The page's "i" popover and the MCP server use it.
// Relative imports only: the MCP server loads this file.
import { bigThoughtGateRules } from "../big-thought/passChecks";
import { BECAUSE_RESULT_LINES } from "../big-thought/because";
import { territoryGateRules } from "../territory/passChecklist";
import { angleGateRules } from "../angle/passChecklist";
import { ideaGateRules } from "../idea/passChecklist";
import { CRITERION_RULE } from "../idea/validation";
import { buildWrittenBeliefCheckPrompt } from "../master-thought/semantic";
import { EXECUTION_PASS_CHECK_IDS } from "../execution/passChecklist";
import { CHECK_REGISTRY, checkEnabled, type CheckLevel, type CheckSettings } from "./checkSettings";

export type ChainLevel = CheckLevel | "pillar" | "execution";

export const NODE_DEFINITIONS = {
  master: {
    label: "Master Thought",
    body: "Master Thought menetapkan keyakinan tujuan: kita ingin orang percaya bahwa ini benar. Bukan tagline dan bukan klaim produk.",
    note: "Subjeknya harus jelas, karena subjek itu yang nanti diuji sebagai penyebab di Idea. Audiens target belum sepenuhnya memercayainya.",
  },
  bigThought: {
    label: "Big Thought",
    body: "Big Thought memberi alasan: Master Thought benar karena alasan ini. Setiap Big Thought membawa alasan dasar yang berbeda.",
    note: "Kalau alasan ini dicabut, Master Thought kehilangan satu alasan untuk dipercaya. Ia canggung sebagai nama ruang atau sebagai pengamatan.",
  },
  territory: {
    label: "Territory",
    body: "Territory menunjuk ruang. Ia area pembahasan di dunia audiens: fenomena, kebiasaan, momen hidup, budaya, atau masalah sehari-hari, tempat alasan Big Thought bisa dibicarakan. Bentuknya kata benda atau frasa benda, tanpa klaim.",
    note: "Ia bagian dari Big Thought, bukan kata kunci Big Thought. Bahasanya bahasa audiens. Di area itu, pertanyaan yang dijawab Big Thought memang muncul. Areanya cukup luas untuk beberapa Angle.",
  },
  angle: {
    label: "Angle",
    body: "Angle mengangkat pengamatan di dalam Territory: hal yang jarang disadari, kontradiksi, atau ketegangan.",
    note: "Bukan alasan. Kalau kalimatnya masuk mulus ke bentuk karena, ia sedang mengerjakan pekerjaan Big Thought. Pengamatan itu disertai satu contoh situasi yang bisa ditunjuk, tanpa menjadi Idea.",
  },
  idea: {
    label: "Idea",
    body: "Idea merancang mekanisme: konsep konkret yang membuat Angle terjadi, terlihat, atau terbukti, lewat demonstrasi, eksperimen, perbandingan, atau situasi.",
    note: "Bentuknya satu kalimat: kita bikin, ajak, tunjukkan, atau ciptakan sesuatu sehingga Angle terbukti. Kunci mekanisme ditulis terpisah di bawah kalimat. Pillar dipilih nanti.",
  },
} as const;

const EXTRA_DEFINITIONS: Record<"pillar" | "execution", { label: string; body: string; note: string }> = {
  pillar: {
    label: "Pillar",
    body: "Pillar adalah content pillar organisasi tempat Idea dikembangkan. Satu Idea yang sudah locked bisa punya beberapa Pillar, masing-masing dengan arah pengembangan sendiri.",
    note: "Arah pengembangan menjelaskan bagaimana Idea itu tampil di pillar tersebut, dan alasan menjelaskan kenapa pillar itu cocok. Pillar dipilih dari pillar yang aktif di organisasi.",
  },
  execution: {
    label: "Execution",
    body: "Execution adalah naskah konten untuk satu Idea di satu Pillar: hook, isi, dan penutup yang membuat mekanisme Idea terlihat di depan penonton.",
    note: "Naskah harus tetap membawa pesan Master Thought lewat rantai sebabnya, terdengar seperti bicara, dan cocok dengan pillar serta formatnya.",
  },
};

/** The shape each level is written in, as the checks expect it. */
const FORMS: Record<ChainLevel, string[]> = {
  master: [
    "Satu kalimat, satu klaim, dalam bahasa audiens. Boleh klaim produk, tidak boleh promosi (penawaran, garansi, harga, diskon, ajakan beli, tagline).",
    "Kalau ada keyakinan lama, kalimat ini harus menggeser keyakinan lama itu, bukan mengulangnya.",
  ],
  bigThought: [
    "Klausa alasan yang bisa dibaca setelah Master Thought + \"karena\" / \"because\".",
    ...BECAUSE_RESULT_LINES,
    "Label opsional: nama pendek alasan itu.",
  ],
  territory: ["Kata benda atau frasa benda (bukan kalimat, bukan klaim, bukan aktivitas), dalam bahasa audiens."],
  angle: [
    "Satu kalimat pengamatan (hal yang jarang disadari, kontradiksi, atau ketegangan) di dalam Territory.",
    "subject: frasa pendek yang membawa fakta khas pengamatan itu. example: satu situasi nyata yang bisa ditunjuk.",
  ],
  idea: [
    "Satu kalimat: \"Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …\" (\"We … so that …\"). Demonstrasi, eksperimen, perbandingan, atau situasi yang bisa ditonton atau diikuti, aman ditiru, dengan subjek Master Thought terlihat sebagai penyebab.",
    "keys: penjelasan lain yang mungkin dipikirkan penonton, dan cara Idea menutup masing-masing.",
  ],
  pillar: ["Pilih content pillar aktif + tulis arah pengembangan (development) dan alasan (reason)."],
  execution: ["Naskah terstruktur per baris untuk satu Idea locked di satu Pillar (lihat thinking.execution.check)."],
};

function cleanRules(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !/: \(none\)$/.test(line) && !/^(Subject|Example|Audience|Question|Master subject)\b.*:\s*$/.test(line))
    .join(" ");
}

function masterRules(): Record<string, string> {
  const prompt = buildWrittenBeliefCheckPrompt({ belief: "", priorBelief: "-" });
  const rules: Record<string, string> = {};
  for (const line of prompt.split("\n")) {
    const match = /^(oneClaim|oneSentence|notPromo|shift):\s*(.+)$/.exec(line.trim());
    if (match) rules[match[1]] = match[2];
  }
  return rules;
}

const SIBLING_RULE: Record<"bigThought" | "territory" | "angle" | "idea", string> = {
  bigThought: "Compared with the other Big Thoughts of this Master Thought: each one carries a different base reason; two that do the same job fail.",
  territory: "Compared with the other Territories of this Big Thought: each one is a different area; one that repeats or contains another fails.",
  angle: "Compared with the other Angles of this Territory: each one is a different observation; one that repeats another fails.",
  idea: "Compared with the other Ideas of this Angle (locked ones included): each one is a different mechanism; one that repeats another fails.",
};

function ruleFor(level: CheckLevel, id: string): string {
  if (level === "master") return masterRules()[id] ?? "";
  if (level === "bigThought") {
    if (id === "sibling") return SIBLING_RULE.bigThought;
    return cleanRules(bigThoughtGateRules(id as Parameters<typeof bigThoughtGateRules>[0]));
  }
  if (id === "siblingsDistinct") return SIBLING_RULE[level];
  if (level === "territory") return cleanRules(territoryGateRules(id as Parameters<typeof territoryGateRules>[0]));
  if (level === "angle") return cleanRules(angleGateRules(id as Parameters<typeof angleGateRules>[0]));
  if (/^K\d$/.test(id)) return (CRITERION_RULE as Record<string, string>)[id] ?? "";
  return cleanRules(ideaGateRules(id as Parameters<typeof ideaGateRules>[0]));
}

export type ChainDefinition = {
  level: ChainLevel;
  label: string;
  definition: string;
  note: string;
  form: string[];
  checks: Array<{ id: string; label: string; on: boolean; rule: string }>;
};

/** Every level of the chain, in order, with each check's rule and whether it is switched on for this organization. */
export function thinkingChainDefinitions(settings: CheckSettings | null | undefined, language: "id" | "en" = "id"): ChainDefinition[] {
  const checked: CheckLevel[] = ["master", "bigThought", "territory", "angle", "idea"];
  const levels: ChainDefinition[] = checked.map((level) => ({
    level,
    label: NODE_DEFINITIONS[level].label,
    definition: NODE_DEFINITIONS[level].body,
    note: NODE_DEFINITIONS[level].note,
    form: FORMS[level],
    checks: CHECK_REGISTRY[level]
      .filter((entry) => entry.id !== "K2")
      .map((entry) => ({
        id: entry.id,
        label: language === "id" ? entry.id_label : entry.en_label,
        on: checkEnabled(settings, level, entry.id),
        rule: ruleFor(level, entry.id),
      })),
  }));
  return [
    ...levels,
    { level: "pillar", label: EXTRA_DEFINITIONS.pillar.label, definition: EXTRA_DEFINITIONS.pillar.body, note: EXTRA_DEFINITIONS.pillar.note, form: FORMS.pillar, checks: [] },
    {
      level: "execution",
      label: EXTRA_DEFINITIONS.execution.label,
      definition: EXTRA_DEFINITIONS.execution.body,
      note: EXTRA_DEFINITIONS.execution.note,
      form: FORMS.execution,
      checks: EXECUTION_PASS_CHECK_IDS.map((id) => ({ id, label: id, on: true, rule: "" })),
    },
  ];
}
