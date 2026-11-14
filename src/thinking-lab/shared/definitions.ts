// What each level of the Thinking Lab chain is, the shape it is written in, and the exact rule of every
// pass check, read from the same code the checks run. The page's "i" popover and the MCP server use it.
// Relative imports only: the MCP server loads this file.
import { bigThoughtGateRules } from "../big-thought/passChecks";
import { territoryGateRules } from "../territory/passChecklist";
import { angleGateRules } from "../angle/passChecklist";
import { IDEA_CHECK_RULES } from "../idea/check/rules";
import type { IdeaCheckId } from "../idea/check/ids";
import { MASTER_CHECK_RULES, type MasterCheckId } from "../master-thought/semantic";
import { EXECUTION_PASS_CHECK_IDS } from "../execution/passChecklist";
import { CHECK_REGISTRY, checkEnabled, type CheckLevel, type CheckSettings } from "./checkSettings";

export type ChainLevel = CheckLevel | "pillar" | "execution";

export const NODE_DEFINITIONS = {
  master: {
    label: "Master Thought",
    body: "Master Thought menetapkan keyakinan tujuan: satu hal yang ingin kita buat dipercaya audiens, yang saat ini belum mereka percayai sepenuhnya. Subjeknya adalah hal yang dimiliki, dilakukan, atau diselesaikan oleh produk atau layanan, bukan nama mereknya. Bukan promosi dan bukan tagline.",
    note: "Subjeknya harus jelas, karena subjek itu yang nanti diuji sebagai penyebab di Idea. Merek baru muncul di Idea sebagai penyebab yang terlihat. Klaimnya harus bisa dipertanggungjawabkan dan tidak menyesatkan. Keyakinan lama wajib diisi. Kategori katalog wajib dipilih. Sub-kategori dan fitur boleh dipilih lebih dari satu agar subjek bisa diperiksa lebih ketat.",
  },
  bigThought: {
    label: "Big Thought",
    body: "Big Thought memberi alasan: Master Thought benar karena alasan ini. Setiap Big Thought membawa alasan dasar yang berbeda, menyangkut subjek Master Thought, dan bisa ditunjukkan atau dialami penonton dalam konten.",
    note: "Kalau alasan ini dicabut, Master Thought kehilangan satu alasan untuk dipercaya. Big Thought bukan Territory (nama ruang) dan bukan Angle (pengamatan). Merek baru muncul di Idea sebagai penyebab yang terlihat.",
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
    body: "Idea merancang mekanisme: konsep konkret yang membuat Angle terjadi, terlihat, atau terbukti, lewat demonstrasi, eksperimen, perbandingan, atau situasi. Situasi boleh berlanjut: akibat yang baru terlihat seiring waktu, dengan subjek Master Thought sebagai titik baliknya.",
    note: "Bentuknya satu kalimat: kita bikin, ajak, tunjukkan, atau ciptakan sesuatu sehingga Angle terbukti. Kunci mekanisme ditulis terpisah di bawah kalimat. Cerita jadi dengan alur dan dialog bukan Idea; ia diceritakan nanti di Pillar.",
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
    "Satu kalimat, satu klaim, dalam bahasa audiens. Tidak menyebut nama merek, toko, atau penyedia. Tidak boleh promosi (penawaran, garansi, harga, diskon, ajakan beli, tagline).",
    "Kalimat ini harus menggeser keyakinan lama, bukan mengulangnya.",
  ],
  bigThought: [
    "Klausa alasan yang bisa dibaca setelah Master Thought + \"karena\".",
    "Tidak perlu \"sehingga\". Sebab yang sudah menjelaskan Master Thought cukup berhenti di situ.",
    "Tambahkan satu hasil dengan \"sehingga\" hanya jika sebab itu saja belum nyambung ke Master Thought.",
    "Hasil itu adalah akibat dari sebab tadi. Tidak boleh mengulang Master Thought dan tidak boleh membuka alasan kedua.",
    "Tidak menyebut nama merek, toko, atau penyedia, dan bukan promosi.",
    "Label opsional: nama pendek alasan itu.",
  ],
  territory: ["Kata benda atau frasa benda (bukan kalimat, bukan klaim, bukan aktivitas), dalam bahasa audiens."],
  angle: [
    "Satu kalimat pengamatan (hal yang jarang disadari, kontradiksi, atau ketegangan) di dalam Territory.",
    "subject: frasa pendek yang membawa fakta khas pengamatan itu. example: satu situasi nyata yang bisa ditunjuk.",
  ],
  idea: [
    "Satu kalimat: \"Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …\" (\"We … so that …\"). Demonstrasi, eksperimen, perbandingan, atau situasi (boleh berlanjut seiring waktu) yang bisa ditonton atau diikuti, aman ditiru, dengan subjek Master Thought terlihat sebagai penyebab.",
    "keys: penjelasan lain yang mungkin dipikirkan penonton, dan cara Idea menutup masing-masing.",
  ],
  pillar: ["Pilih content pillar aktif + tulis arah pengembangan (development) dan alasan (reason)."],
  execution: ["Naskah terstruktur per baris untuk satu Idea locked di satu Pillar (lihat thinking.execution.check)."],
};

function cleanRules(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    // Lines that only describe a missing input of one real check (no question, no subject) are not part of the rule.
    .filter((line) => line && !/: \(none\)$/.test(line) && !/^No .+ (was|were) (supplied|named), so pass is false\.$/.test(line))
    .join(" ");
}

const SIBLING_RULE: Record<"bigThought" | "territory" | "angle", string> = {
  bigThought: "Dibandingkan dengan Big Thought lain di Master Thought ini: setiap Big Thought membawa alasan dasar yang berbeda. Dua Big Thought yang mengerjakan tugas yang sama gagal.",
  territory: "Compared with the other Territories of this Big Thought: each one is a different area; one that repeats or contains another fails.",
  angle: "Compared with the other Angles of this Territory: each one is a different observation; one that repeats another fails.",
};

function ruleFor(level: CheckLevel, id: string): string {
  if (level === "master") return MASTER_CHECK_RULES[id as MasterCheckId] ?? "";
  if (level === "bigThought") {
    if (id === "sibling") return SIBLING_RULE.bigThought;
    return cleanRules(bigThoughtGateRules(id as Parameters<typeof bigThoughtGateRules>[0]));
  }
  if (level === "idea") return IDEA_CHECK_RULES[id as IdeaCheckId].join(" ");
  if (id === "siblingsDistinct") return SIBLING_RULE[level];
  if (level === "territory") return cleanRules(territoryGateRules(id as Parameters<typeof territoryGateRules>[0]));
  return cleanRules(angleGateRules(id as Parameters<typeof angleGateRules>[0]));
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
    checks: CHECK_REGISTRY[level].map((entry) => ({
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
