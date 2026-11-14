// Runs the six Big Thought checks on one sentence, in order, and stops at the first one that does not pass.
// The same runner serves Generate, a manual add or edit, Revise, Audit of cards never checked, and the MCP server.
// "duplicate" compares the sentence with the Big Thoughts that already passed: a different basic reason.
// Relative imports only: the MCP server loads this file.
import { bigThoughtRepeats } from "./label";
import type { PassChecklist, PassGateCheck, PassGateId } from "./checklist";
import { PASS_GATE_IDS } from "./checklist";
import { UNDECIDED_REASON, buildBatchGatePrompt, parseGateAnswer, type GateAnswer } from "../shared/batchGates";
import { runGateChain, type GateStep } from "../shared/gateChain";
import { shownBigThoughtFacts } from "./generate";
import type { BigThoughtFacts } from "./types";

/** The exact rule of every individual Big Thought check. The model judges with these words and the page shows them. */
const BIG_THOUGHT_GATE_RULES: Readonly<Record<PassGateId, readonly string[]>> = {
  resolved: [
    "Lolos hanya jika kalimatnya klaim utuh yang bisa dinilai.",
    "Gagal jika berupa potongan kalimat, judul, atau belum selesai.",
  ],
  relation: [
    "Lolos hanya jika kalimat ini adalah alasan, dasar, atau bukti tersendiri untuk Master Thought, dan menyisipkan kata \"karena\" di antara Master Thought dan kalimat ini sudah membentuk satu kalimat yang utuh. Kalimat gabungan itu menuntaskan keyakinan, termasuk perbandingannya, tanpa mengulang Master Thought dan tanpa membuka klaim baru. Satu hasil dari sebab yang sama, disambung dengan \"sehingga\", tetap bagian dari alasan.",
    "Gagal jika kalimat ini klaim sendiri yang harus ditulis ulang agar bisa mengikuti \"karena\", hanya menyebut sebuah area, atau berupa pengamatan yang jarang disadari, bukan alasan. Gagal juga jika hanya mengulang atau menguraikan Master Thought, atau hanya berupa hasil akhir, cara atau metode, contoh, kriteria, taktik, atau eksekusi. Langkah mengerjakan, membuat, menyiapkan, atau menyajikan sesuatu adalah metode, walaupun diikuti \"sehingga\" dan hasilnya. Sifat subjek itu sendiri (apa adanya atau apa yang dimilikinya) bukan metode. Bagian hasil juga gagal jika mengulang Master Thought atau membuka alasan kedua.",
  ],
  explains: [
    "Lolos hanya jika Master Thought benar karena kalimat ini, dan menghapus kalimat ini membuat Master Thought kehilangan satu alasan untuk dipercaya.",
    "Gagal jika bentuk \"karena\"-nya berputar-putar, atau menghapus kalimat ini tidak mengubah apa-apa karena tidak menambah alasan yang dibutuhkan Master Thought.",
    "Jangan gagalkan hanya karena tidak ada hasil dengan \"sehingga\". Sebab yang sudah menjelaskan Master Thought sudah cukup.",
  ],
  premise: [
    "Lolos jika kalimat ini premis, alasan, atau bukti yang wajar dan bisa dipertahankan untuk Master Thought.",
    "Informasi baru yang belum disebut Master Thought boleh. Jangan gagalkan hanya karena Master Thought tidak memuat atau membuktikan kalimat ini.",
    "Gagal hanya jika dukungannya bergantung pada klaim faktual yang terlalu spesifik dan butuh bukti terpisah: kepastian yang dikarang, jaminan mutlak, angka atau jangka waktu yang presisi, atau prediksi pasti yang tidak bisa berdiri tanpa bukti.",
    "Alasan wajar tentang produk, layanan, proses, atau sebab-akibat boleh lolos selama tidak mengarang kepastian. Tanda peringatan tidak otomatis berarti gagal.",
  ],
  showable: [
    "Lolos jika alasan ini menyangkut subjek Master Thought dan bisa ditunjukkan, dibandingkan, atau dialami penonton dalam konten.",
    "Gagal jika alasannya abstrak, tidak menyangkut subjek Master Thought, atau hanya bisa diterima dengan percaya begitu saja.",
  ],
  duplicate: [
    "Lolos hanya jika Big Thought ini membawa alasan dasar yang berbeda dari setiap Big Thought yang sudah lolos.",
    "Gagal jika mengulang salah satunya, atau mengerjakan tugas yang sama dengan kata lain: alasan dasar yang sama untuk Master Thought. Jika gagal, sebut kode Big Thought yang diulang.",
    "Topik atau kata yang sama tidak membuatnya gagal selama alasan dasarnya berbeda.",
  ],
};

const UNDECIDED = UNDECIDED_REASON;

export function emptyBigThoughtChecks(): PassGateCheck[] {
  return PASS_GATE_IDS.map((id) => ({ id, state: "pending", reason: "" }));
}

function checklistFrom(items: PassGateCheck[], report?: PassChecklist["report"]): PassChecklist {
  const failureItem = items.find((item) => item.state === "fail");
  const failure = failureItem
    ? {
        gate: failureItem.id,
        reason: failureItem.reason || UNDECIDED,
        earlier: items.some((item) => item.state === "pass") ? ("pass" as const) : ("unchecked" as const),
      }
    : null;
  return {
    items: items.map((item) => ({ ...item })),
    passed: failure == null && PASS_GATE_IDS.every((id) => items.some((item) => item.id === id && item.state === "pass")),
    lesson: null,
    failure,
    report: report ?? null,
  };
}

const GATE_REASON = /^([a-z][A-Za-z0-9]*):\s*([\s\S]+)$/;

/** Earlier failures for this gate only. Unprefixed reasons stay out so other gates do not leak in. */
export function lessonsForPassGate(
  lessons: ReadonlyArray<{ statement: string; reason: string }> | undefined,
  gate: string,
): Array<{ statement: string; reason: string }> {
  if (!lessons?.length) return [];
  return lessons.flatMap((lesson) => {
    const match = lesson.reason.trim().match(GATE_REASON);
    if (!match || match[1] !== gate) return [];
    const detail = match[2].trim();
    if (!detail) return [];
    return [{ statement: lesson.statement, reason: detail }];
  });
}

/** The rule text of one Big Thought check, shared by the one-check and the batched prompts. */
export function bigThoughtGateRules(id: PassGateId): string[] {
  return [...BIG_THOUGHT_GATE_RULES[id]];
}

/** Every open Big Thought check of one sentence in one prompt. */
export function buildBigThoughtBatchPrompt(input: {
  ids: ReadonlyArray<PassGateId>;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
}): string {
  const others =
    input.others.length === 0 ? "(none)" : input.others.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return buildBatchGatePrompt({
    item: "Big Thought",
    language: "Master Thought",
    gates: input.ids.map((id) => {
      const gateLessons = lessonsForPassGate(input.lessons, id);
      return {
        id,
        rules: bigThoughtGateRules(id),
        extra: [
          ...(id === "duplicate" ? ["Big Thoughts that already passed:", others] : []),
          ...(gateLessons.length === 0
            ? []
            : [
              `Earlier ${id} failures for this Big Thought. Do not pass a sentence that repeats this mistake:`,
              ...gateLessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`),
            ]),
        ],
      };
    }),
    context: [`Big Thought: ${input.statement.trim()}`, "Master Thought:", input.parentStatement.trim()],
  });
}

export function buildBigThoughtPassPrompt(input: {
  id: PassGateId;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
}): string {
  const rule = bigThoughtGateRules(input.id);
  const others =
    input.others.length === 0
      ? "(none)"
      : input.others.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const gateLessons = lessonsForPassGate(input.lessons, input.id);
  const lessonLines =
    gateLessons.length === 0
      ? []
      : [
          "",
          `Earlier ${input.id} failures for this Big Thought. Do not pass a sentence that repeats this mistake:`,
          ...gateLessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`),
        ];
  return [
    "Decide one Big Thought pass check. Do not rewrite the sentence.",
    ...rule,
    "When pass is false, reason says why in the same language as the Master Thought.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Big Thought: ${input.statement.trim()}`,
    "Master Thought:",
    input.parentStatement.trim(),
    ...(input.id === "duplicate" ? ["", "Big Thoughts that already passed:", others] : []),
    ...lessonLines,
  ].join("\n");
}

export const parseBigThoughtPassCheck = parseGateAnswer;

type Peer = { code: string; statement: string; label?: string };

/** The duplicate check decided without a model: an exact repeat fails, no passed Big Thought passes. */
function duplicateInCode(statement: string, others: readonly Peer[]): GateAnswer | null {
  const repeated = others.find((row) =>
    bigThoughtRepeats({ label: "", statement }, { label: row.label, statement: row.statement }),
  );
  if (repeated) return { pass: false, reason: `Same Big Thought as ${repeated.code}.` };
  if (others.length === 0) return { pass: true, reason: "" };
  return null;
}

/** The runner's steps as the Big Thought checklist: a running check shows "checking", checks after a fail "unchecked". */
function checklistFromSteps(steps: readonly GateStep<PassGateId>[], previous: readonly GateStep<PassGateId>[]): PassChecklist {
  const failed = steps.some((step) => step.state === "fail");
  const items: PassGateCheck[] = steps.map((step) => ({
    id: step.id,
    state: step.state === "running" ? "checking" : failed && step.state === "pending" ? "unchecked" : step.state,
    reason: step.state === "fail" ? (step.reason ?? "") : step.state === "pass" ? (step.reason ?? "") : "",
  }));
  const changed = steps.find((step, index) => step.state !== previous[index]?.state);
  const report =
    changed && changed.state !== "pending"
      ? {
          gate: changed.id,
          phase: changed.state === "running" ? ("checking" as const) : ("checked" as const),
          outcome: changed.state === "fail" ? ("fail" as const) : ("pass" as const),
        }
      : null;
  return checklistFrom(items, report);
}

/**
 * Runs the six checks in order and stops at the first one that does not pass.
 * A check switched OFF, or kept from an earlier pass on this card, is not asked.
 */
export async function runBigThoughtChecks(input: {
  statement: string;
  parentStatement: string;
  /** Big Thoughts that already passed (or are locked); the card itself is not in this list. */
  others: readonly Peer[];
  /** Earlier failures of this card. Each check's prompt keeps only its own. */
  lessons?: Array<{ statement: string; reason: string }>;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  /** Checks that already passed on this exact card; they stay passed. */
  keep?: readonly PassGateId[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const others = [...input.others];
  const coded = duplicateInCode(input.statement, others);
  const context = { statement: input.statement, parentStatement: input.parentStatement, others, lessons: input.lessons };
  let previous: GateStep<PassGateId>[] = [];
  let last: PassChecklist | null = null;
  await runGateChain({
    ids: PASS_GATE_IDS,
    skip: input.skip,
    keep: input.keep,
    decided: (id) => (id === "duplicate" ? coded : null),
    batchPrompt: (ids) => buildBigThoughtBatchPrompt({ ...context, ids }),
    prompt: (id) => buildBigThoughtPassPrompt({ ...context, id }),
    ask: input.ask,
    onStep: async (steps) => {
      last = checklistFromSteps(steps, previous);
      previous = steps;
      await input.onStep?.(last);
    },
  });
  return last ?? checklistFrom(emptyBigThoughtChecks());
}

/**
 * The facts stored with a sentence after its checks. A failed check makes the sentence a reject, so
 * Generate does not save it: a repeat or a restatement by its relation, a missing reason by "explains",
 * an unsupported premise by its relation, anything else stays unresolved.
 */
export function factsForBigThoughtChecks(code: string, statement: string, checklist: PassChecklist): BigThoughtFacts {
  const facts = shownBigThoughtFacts(code, statement);
  const failure = checklist.failure;
  if (!failure) return facts;
  if (failure.gate === "duplicate") return { ...facts, relationToParent: "DUPLICATE", explainsWhyParentIsTrue: false };
  if (failure.gate === "relation") return { ...facts, relationToParent: "RESTATEMENT", explainsWhyParentIsTrue: false };
  if (failure.gate === "explains") return { ...facts, explainsWhyParentIsTrue: false };
  if (failure.gate === "premise") {
    return { ...facts, relationToParent: "UNSUPPORTED_PREMISE", introducesUnsupportedPremise: true, explainsWhyParentIsTrue: false };
  }
  return { ...facts, resolution: "UNRESOLVED", unresolvedReasons: [failure.reason] };
}
