import { bigThoughtRepeats } from "./label";
import type { PassChecklist, PassGateCheck, PassGateId } from "./checklist";
import { PASS_GATE_IDS } from "./checklist";
import { parseModelJson } from "../shared/parseModelJson";
import { UNDECIDED_REASON, answerGate, askBatchGates, buildBatchGatePrompt, parseGateAnswer, type GateAnswer } from "../shared/batchGates";
import { fixScopeLines, openMistakeLines, type FixScope } from "../shared/fixScope";
import { parseGeneratedBigThoughts, shownBigThoughtFacts } from "./generate";
import type { BigThoughtFacts, GeneratePassGate } from "./types";

/** Generate admits a sentence only after these three. Audit repeats the duplicate check by meaning, and keeps the other two while the sentence stays the same. */
export const GENERATE_ADMISSION_GATES = ["duplicate", "resolved", "relation"] as const satisfies readonly PassGateId[];

const INDIVIDUAL_GATE_IDS = [
  "resolved",
  "relation",
  "explains",
  "premise",
  "showable",
  "duplicate",
] as const satisfies readonly PassGateId[];

type IndividualGateId = (typeof INDIVIDUAL_GATE_IDS)[number];

/** The exact rule of every individual Big Thought check. The model judges with these words and the page shows them. */
const BIG_THOUGHT_GATE_RULES: Readonly<Record<IndividualGateId, readonly string[]>> = {
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
    "Lolos hanya jika Big Thought ini bukan Big Thought yang sama dengan yang sudah lolos.",
    "Gagal jika mengulang salah satu Big Thought itu.",
  ],
};

const UNDECIDED = UNDECIDED_REASON;

export function emptyBigThoughtChecks(): PassGateCheck[] {
  return PASS_GATE_IDS.map((id) => ({ id, state: "pending", reason: "" }));
}

function admissionChecklist(items: PassGateCheck[], report?: PassChecklist["report"]): PassChecklist {
  const watched = GENERATE_ADMISSION_GATES.map(
    (id) => items.find((item) => item.id === id) ?? { id, state: "unchecked" as const, reason: "" },
  );
  const failureItem = watched.find((item) => item.state === "fail");
  const failure = failureItem
    ? {
        gate: failureItem.id,
        reason: failureItem.reason || UNDECIDED,
        earlier: watched.some(
          (item) =>
            item.state === "pass" &&
            GENERATE_ADMISSION_GATES.findIndex((gate) => gate === item.id) <
              GENERATE_ADMISSION_GATES.findIndex((gate) => gate === failureItem.id),
        )
          ? ("pass" as const)
          : ("unchecked" as const),
      }
    : null;
  return {
    items: items.map((item) => ({ ...item })),
    passed: watched.every((item) => item.state === "pass"),
    lesson: null,
    failure,
    report: report ?? null,
  };
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
    passed: failure == null && INDIVIDUAL_GATE_IDS.every((id) => items.some((item) => item.id === id && item.state === "pass")),
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
export function bigThoughtGateRules(id: IndividualGateId): string[] {
  return [...BIG_THOUGHT_GATE_RULES[id]];
}

/** Every open Big Thought check of one sentence in one prompt. */
export function buildBigThoughtBatchPrompt(input: {
  ids: ReadonlyArray<IndividualGateId>;
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
  id: IndividualGateId;
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

/** Checks that judge what kind of statement it is. Patching a part cannot change the kind. */
export const BT_KIND_GATES = ["relation", "explains"] as const;

export type BigThoughtFixMode = "repair" | "replace";

/** How many lessons failed on this check. Lesson reasons start with "<gate>: ". */
export function lessonsOnGate(lessons: ReadonlyArray<{ reason: string }>, gate: string): number {
  if (!gate) return 0;
  const prefix = `${gate}:`;
  return lessons.filter((lesson) => lesson.reason.trim().startsWith(prefix)).length;
}

/**
 * Repair patches the failed part. Once a kind check (method, restatement, explains)
 * has failed `replaceAfter` times, patching keeps the same idea, so the fix writes a new reason.
 */
export function bigThoughtFixMode(input: {
  gate: string;
  lessons: ReadonlyArray<{ reason: string }>;
  replaceAfter: number;
  force?: BigThoughtFixMode;
}): BigThoughtFixMode {
  if (input.force) return input.force;
  if (!(BT_KIND_GATES as readonly string[]).includes(input.gate)) return "repair";
  return lessonsOnGate(input.lessons, input.gate) >= input.replaceAfter ? "replace" : "repair";
}

export function buildBigThoughtFixPrompt(input: {
  parentStatement: string;
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  scope: FixScope;
  lessons?: Array<{ statement: string; reason: string }>;
  mode?: BigThoughtFixMode;
}): string {
  if (input.mode === "replace") return buildBigThoughtReplacePrompt(input);
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Rewrite only the failed part of this Big Thought.",
    "Keep the checks that already passed. Do not write a new Big Thought from the beginning.",
    "The sentence is one because-clause in the same language as the Master Thought.",
    "It is a distinct material reason, basis, or evidence for why the Master Thought is true.",
    "Do not repeat a keeper or the failed sentence.",
    ...fixScopeLines(input.scope),
    "Return JSON only: {\"items\":[{\"label\":\"\",\"statement\":\"...\"}]}",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Failed Big Thought:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Big Thoughts that stay:",
    keeperLines,
    "",
    "Earlier failures. Do not repeat these sentences or this mistake:",
    lessonLines,
    ...openMistakeLines(
      lessons.map((lesson) => ({ reason: lesson.reason })),
      input.scope,
    ),
  ].join("\n");
}

function buildBigThoughtReplacePrompt(input: {
  parentStatement: string;
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Write a new Big Thought for this place. Patching the failed one did not work: its idea keeps failing the same check.",
    "Do not keep the failed sentence's idea, subject, or mechanism. Choose a different reason.",
    "The sentence is one because-clause in the same language as the Master Thought.",
    "It is a distinct material reason, basis, or evidence for why the Master Thought is true.",
    "It is not a method, recipe, process, or way of doing something. It is not an outcome, a restatement, or an unpacking of the Master Thought.",
    "It must explain the main claim of the Master Thought, not a side benefit.",
    "Do not cover what a Big Thought that stays already covers.",
    "Return JSON only: {\"items\":[{\"label\":\"\",\"statement\":\"...\"}]}",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Failed Big Thought:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Big Thoughts that stay:",
    keeperLines,
    "",
    "Earlier failures. Do not repeat these sentences or this mistake:",
    lessonLines,
  ].join("\n");
}

export function parseBigThoughtFixStatement(script: string | null, parentStatement: string): string {
  if (!script?.trim()) return "";
  return parseGeneratedBigThoughts(parseModelJson(script), parentStatement)[0]?.statement.trim() ?? "";
}

async function askGate(input: {
  id: IndividualGateId;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
  ask: (prompt: string) => Promise<string | null>;
  /** The answer of the batched call for this check, when it came back. */
  answer?: GateAnswer;
}): Promise<{ pass: boolean; reason: string }> {
  if (input.id === "duplicate") {
    const repeated = input.others.find((row) =>
      bigThoughtRepeats({ label: "", statement: input.statement }, { label: row.label, statement: row.statement }),
    );
    if (repeated) return { pass: false, reason: `Same Big Thought as ${repeated.code}.` };
    if (input.others.length === 0) return { pass: true, reason: "" };
  }
  return answerGate({
    batched: input.answer,
    prompt: () =>
      buildBigThoughtPassPrompt({
        id: input.id,
        statement: input.statement,
        parentStatement: input.parentStatement,
        others: input.others,
        lessons: input.lessons,
      }),
    ask: input.ask,
  });
}

function admissionItems(duplicate: PassGateCheck): PassGateCheck[] {
  return PASS_GATE_IDS.map((id) => {
    if (id === "duplicate") return duplicate;
    if (id === "resolved" || id === "relation") return { id, state: "pending" as const, reason: "" };
    return { id, state: "unchecked" as const, reason: "" };
  });
}

/** Exact copy or the same label. No model call, and the other generate checks stay unasked. */
export function generateDuplicateFailure(reason: string): PassChecklist {
  return admissionChecklist(
    PASS_GATE_IDS.map((id) => ({
      id,
      state: id === "duplicate" ? ("fail" as const) : ("unchecked" as const),
      reason: id === "duplicate" ? reason : "",
    })),
    { gate: "duplicate", phase: "checked", outcome: "fail" },
  );
}

/**
 * Generate checks the coarse duplicate before this runs.
 * Then one model call for a finished sentence, and one for a real reason.
 */
export async function runGenerateAdmissionChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const items = admissionItems({ id: "duplicate", state: "pass", reason: "" });
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(admissionChecklist(items, { gate: id, phase, outcome }));
  };
  await publish("duplicate", "checked", "pass");
  const batched = await batchedBigThoughtAnswers({
    batch: input.batch,
    open: (["resolved", "relation"] as const).filter((id) => !input.skip?.includes(id)),
    statement: input.statement,
    parentStatement: input.parentStatement,
    others: [],
    ask: input.ask,
  });
  for (const id of ["resolved", "relation"] as const) {
    const index = items.findIndex((item) => item.id === id);
    if (input.skip?.includes(id)) {
      items[index] = { id, state: "pass", reason: "" };
      await publish(id, "checked", "pass");
      continue;
    }
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      others: [],
      ask: input.ask,
      answer: batched.get(id),
    });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      for (const later of ["resolved", "relation"] as const) {
        const laterIndex = items.findIndex((item) => item.id === later);
        if (items[laterIndex]?.state === "pending") {
          items[laterIndex] = { id: later, state: "unchecked", reason: "" };
        }
      }
      const checklist = admissionChecklist(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return admissionChecklist(items, { gate: "relation", phase: "checked", outcome: "pass" });
}

export function factsForGenerateAdmission(statement: string, checklist: PassChecklist): BigThoughtFacts {
  if (checklist.passed || !checklist.failure) {
    const facts = shownBigThoughtFacts("NEW", statement);
    const resolved = checklist.items.some((item) => item.id === "resolved" && item.state === "pass");
    const relation = checklist.items.some((item) => item.id === "relation" && item.state === "pass");
    if (resolved && relation) return { ...facts, generatePasses: ["resolved", "relation"] };
    return facts;
  }
  if (checklist.failure.gate === "duplicate") {
    return {
      ...shownBigThoughtFacts("NEW", statement),
      relationToParent: "DUPLICATE",
      explainsWhyParentIsTrue: false,
    };
  }
  if (checklist.failure.gate === "relation") {
    return {
      ...shownBigThoughtFacts("NEW", statement),
      relationToParent: "RESTATEMENT",
      explainsWhyParentIsTrue: false,
    };
  }
  return {
    ...shownBigThoughtFacts("NEW", statement),
    resolution: "UNRESOLVED",
    unresolvedReasons: [checklist.failure.reason],
  };
}

/** A rewritten sentence loses the two Generate passes. Checks that passed on this sentence stay. */
export function fixPriorForNextSentence(
  prior: readonly PassGateCheck[],
  previousStatement: string,
  nextStatement: string,
): PassGateCheck[] {
  const changed = previousStatement.trim().toLocaleLowerCase() !== nextStatement.trim().toLocaleLowerCase();
  return prior.map((item) =>
    changed && (item.id === "resolved" || item.id === "relation")
      ? { id: item.id, state: "pending", reason: "" }
      : { ...item },
  );
}

export async function runBigThoughtIndividualChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  /** Generate passes for this exact sentence. Audit does not ask these again. */
  carried?: readonly GeneratePassGate[];
  /** Prior fix/audit failures for this card. Gate prompts keep only matching gate ids. */
  lessons?: Array<{ statement: string; reason: string }>;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const carried = new Set<GeneratePassGate>(input.carried ?? []);
  const skip = new Set<string>(input.skip ?? []);
  const items = emptyBigThoughtChecks().map((item) =>
    (carried.has(item.id as GeneratePassGate) && (item.id === "resolved" || item.id === "relation")) || skip.has(item.id)
      ? { id: item.id, state: "pass" as const, reason: "" }
      : item,
  );
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(checklistFrom(items, { gate: id, phase, outcome }));
  };
  if (carried.size === 0) await input.onStep?.(checklistFrom(items));
  const batched = await batchedBigThoughtAnswers({
    ...input,
    open: INDIVIDUAL_GATE_IDS.filter((id) => items.find((item) => item.id === id)?.state !== "pass"),
  });
  for (const id of INDIVIDUAL_GATE_IDS) {
    const index = items.findIndex((item) => item.id === id);
    if (items[index]?.state === "pass") continue;
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({ ...input, id, lessons: input.lessons, answer: batched.get(id) });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      const checklist = checklistFrom(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return checklistFrom(items, { gate: "premise", phase: "checked", outcome: "pass" });
}

/** Re-ask the checks that failed or have not run. A passed check stays passed. */
export async function runBigThoughtOpenChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  prior: readonly PassGateCheck[];
  lessons?: Array<{ statement: string; reason: string }>;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<PassChecklist> {
  const items: PassGateCheck[] = emptyBigThoughtChecks().map((item) => {
    const previous = input.prior.find((check) => check.id === item.id);
    return previous?.state === "pass" || input.skip?.includes(item.id) ? { id: item.id, state: "pass" as const, reason: "" } : { id: item.id, state: "pending" as const, reason: "" };
  });
  const publish = async (id: PassGateId, phase: "checking" | "checked", outcome: "pass" | "fail") => {
    await input.onStep?.(checklistFrom(items, { gate: id, phase, outcome }));
  };
  await input.onStep?.(checklistFrom(items));
  const batched = await batchedBigThoughtAnswers({
    ...input,
    open: INDIVIDUAL_GATE_IDS.filter((id) => items.find((item) => item.id === id)?.state !== "pass"),
  });
  for (const id of INDIVIDUAL_GATE_IDS) {
    const index = items.findIndex((item) => item.id === id);
    if (items[index]?.state === "pass") continue;
    items[index] = { id, state: "checking", reason: "" };
    await publish(id, "checking", "pass");
    const parsed = await askGate({ ...input, id, lessons: input.lessons, answer: batched.get(id) });
    if (!parsed.pass) {
      items[index] = { id, state: "fail", reason: parsed.reason };
      const checklist = checklistFrom(items, { gate: id, phase: "checked", outcome: "fail" });
      await input.onStep?.(checklist);
      return checklist;
    }
    items[index] = { id, state: "pass", reason: "" };
    await publish(id, "checked", "pass");
  }
  return checklistFrom(items, { gate: "premise", phase: "checked", outcome: "pass" });
}

/**
 * One model call for every open check of one sentence. The duplicate check is left out when it
 * is decided without a model (an exact repeat, or no other Big Thought yet).
 */
async function batchedBigThoughtAnswers(input: {
  batch?: boolean;
  open: ReadonlyArray<IndividualGateId>;
  statement: string;
  parentStatement: string;
  others: Array<{ code: string; statement: string; label?: string }>;
  lessons?: Array<{ statement: string; reason: string }>;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<Map<string, GateAnswer>> {
  if (!input.batch) return new Map();
  const modelIds = input.open.filter((id) => {
    if (id !== "duplicate") return true;
    if (input.others.length === 0) return false;
    return !input.others.some((row) =>
      bigThoughtRepeats({ label: "", statement: input.statement }, { label: row.label, statement: row.statement }),
    );
  });
  if (modelIds.length < 2) return new Map();
  const answers = await askBatchGates({
    prompt: buildBigThoughtBatchPrompt({
      ids: modelIds,
      statement: input.statement,
      parentStatement: input.parentStatement,
      others: input.others,
      lessons: input.lessons,
    }),
    ids: modelIds,
    ask: input.ask,
  });
  return answers ?? new Map();
}
