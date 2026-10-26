import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";

export type DecisionBind = "viewpoint" | "frame" | "story";

export type ScriptDecision = {
  category: string;
  question: string;
  answer: string;
  binds: DecisionBind;
};

export type ExecutionConfirmQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  binds: DecisionBind;
};

export type DiscoveryResult = { ok: true; questions: ExecutionConfirmQuestion[] } | { ok: false };

export type ScriptConfirmation = {
  question: string;
  answer: string;
};

const GENERIC_VIEWPOINT = new Set([
  "third person",
  "orang ketiga",
  "brand",
  "narrator",
  "narator",
  "someone",
  "seseorang",
  "orang",
]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function clean(value: unknown, limit: number): string {
  const text = asText(value).replace(/\s+/g, " ");
  if (!text || text.length > limit) return "";
  return text;
}

function isGenericViewpoint(option: string): boolean {
  return GENERIC_VIEWPOINT.has(option.trim().toLowerCase());
}

export function parseViewpointOptions(raw: unknown): string[] | null {
  const row = asRecord(raw);
  const source = row ? asList(row.options ?? row.choices) : asList(raw);
  const options = [
    ...new Set(source.map((option) => clean(option, 160)).filter((option) => option && !isGenericViewpoint(option))),
  ].slice(0, 4);
  if (options.length < 2) return null;
  return options;
}

export function readScriptConfirmations(value: unknown): ScriptConfirmation[] {
  return asList(value)
    .flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const question = clean(row.question, 240);
      const answer = clean(row.answer, 160);
      if (!question || !answer) return [];
      return [{ question, answer }];
    })
    .slice(0, 3);
}

export function readScriptDecisions(value: unknown): ScriptDecision[] {
  return asList(value)
    .flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const category = clean(row.category, 80);
      const question = clean(row.question, 240);
      const answer = clean(row.answer, 160);
      const binds = decisionBind(row.binds, category, question);
      if (!category || !question || !answer || !binds) return [];
      return [{ category, question, answer, binds }];
    })
    .slice(0, 8);
}

export function readPointOfView(value: unknown, confirmations?: unknown, decisions?: unknown): string | null {
  const fromDecision = readScriptDecisions(decisions).find((row) => row.binds === "viewpoint")?.answer ?? "";
  if (fromDecision) return fromDecision;
  const direct = clean(value, 160);
  if (direct) return direct;
  return readScriptConfirmations(confirmations)[0]?.answer ?? null;
}

const LOCKED_TOPIC =
  /\b(durasi|duration|how long|berapa lama|berapa detik|how many seconds|ugc|cinematic|commercial|gaya visual|visual style|speech mode|mode bicara|ejaan|spelling|brand spelling|nama brand|nama merek|call to action|cta|ajakan|content pillar|pilar konten|format video|format konten|which pillar|pilar mana|aspect ratio|rasio gambar|resolusi)\b/i;

function decisionBind(value: unknown, category: string, prompt: string): DecisionBind | null {
  const explicit = asText(value).toLowerCase();
  if (explicit === "viewpoint" || explicit === "pov" || explicit === "pointofview") return "viewpoint";
  if (explicit === "frame" || explicit === "camera") return "frame";
  if (explicit === "story") return "story";
  const text = `${category} ${prompt}`.toLowerCase();
  if (/sudut pandang|point of view|\bpov\b|siapa yang bercerita|who tells|diceritakan dari|whose point of view/.test(text)) return "viewpoint";
  if (/kamera mengikuti|camera follows|who the camera|siapa yang diikuti kamera|siapa di gambar|who is in frame|who stays in frame/.test(text)) return "frame";
  return "story";
}

function optionSignature(options: string[]): string {
  return options.map((option) => option.toLowerCase()).sort().join("|");
}

export function parseDiscoveredQuestions(raw: unknown): DiscoveryResult {
  const row = asRecord(raw);
  if (!row || !Array.isArray(row.questions)) return { ok: false };
  const seenOptions = new Set<string>();
  const seenPrompts = new Set<string>();
  let viewpointOptions = "";
  const questions: ExecutionConfirmQuestion[] = [];
  for (const item of row.questions) {
    const questionRow = asRecord(item);
    if (!questionRow) continue;
    const prompt = clean(questionRow.prompt ?? questionRow.question, 240);
    const category = clean(questionRow.category, 80) || prompt.slice(0, 80);
    if (!prompt || !category || LOCKED_TOPIC.test(`${category} ${prompt}`)) continue;
    let binds = decisionBind(questionRow.binds, category, prompt);
    if (!binds) continue;
    const options = [
      ...new Set(asList(questionRow.options).map((option) => clean(option, 160)).filter((option) => option && !isGenericViewpoint(option))),
    ].slice(0, 4);
    if (options.length < 2) continue;
    const signature = optionSignature(options);
    const promptKey = prompt.toLowerCase();
    if (seenOptions.has(signature) || seenPrompts.has(promptKey)) continue;
    if (binds === "frame" && signature === viewpointOptions) continue;
    if (binds === "viewpoint" && viewpointOptions) binds = "story";
    seenOptions.add(signature);
    seenPrompts.add(promptKey);
    if (binds === "viewpoint") viewpointOptions = signature;
    questions.push({ id: `q${questions.length + 1}`, category, prompt, options, binds });
    if (questions.length === 8) break;
  }
  return { ok: true, questions };
}

export function confirmedViewpointRules(pointOfView: string | null | undefined): string[] {
  const viewpoint = pointOfView?.trim() ?? "";
  if (!viewpoint) return [];
  return [
    `The narration has one point of view: "${viewpoint}".`,
    "The first scene names that point of view, so a viewer can tell who is speaking.",
    "Every later scene stays inside that same point of view. Do not switch.",
    "Narrate only what that point of view can see, hear, or think.",
    "Do not narrate another person's private thoughts.",
    "Do not describe the same moment once from each person.",
  ];
}

export function confirmedDecisionRules(decisions: ScriptDecision[] | null | undefined, pointOfView?: string | null): string[] {
  const rows = decisions ?? [];
  const viewpoint = rows.find((row) => row.binds === "viewpoint")?.answer ?? pointOfView?.trim() ?? "";
  const lines = [...(rows.length > 0 ? ["These choices are locked. Do not reopen them."] : []), ...confirmedViewpointRules(viewpoint)];
  for (const row of rows) {
    if (row.binds === "viewpoint") continue;
    if (row.binds === "frame") {
      lines.push(`The camera stays with "${row.answer}".`, "Do not switch who the picture follows.");
      continue;
    }
    lines.push(
      `Locked choice — ${row.category}: "${row.answer}".`,
      `The question was: ${row.question}`,
      "Use that choice as the concrete instance of a step the locked pillar communication already contains.",
      "Keep it inside that step. Do not add a scene for this choice.",
      "Keep the time and the status of that step. Advice stays advice. A step that has not happened yet does not become a memory of it already having happened.",
      "Do not state that desire before the question the pillar communication already asks.",
      "Do not replace the method the pillar communication already gives.",
    );
  }
  return lines;
}

export function claimMaterialLines(input: {
  pillarDevelopment?: string | null;
  decisions?: ScriptDecision[] | null;
}): string[] {
  const development = input.pillarDevelopment?.trim() ?? "";
  const stories = (input.decisions ?? []).filter((row) => row.binds === "story" && row.answer.trim());
  if (!development && stories.length === 0) return [];
  return [
    "Locked material may be written. A detail from this material is not a new claim.",
    ...(development ? ["Locked pillar communication:", development] : []),
    ...stories.flatMap((row) => [
      `Locked story answer — ${row.category}: "${row.answer.trim()}".`,
      `The question was: ${row.question.trim()}`,
    ]),
    "A situation, a desire, a need, or a consequence that is not in the Idea and not in this locked material is a new claim.",
    "A specific desire the Idea leaves unnamed is a new claim unless a locked story answer names it.",
    ...pillarFidelityLines(development),
  ];
}

export function pillarFidelityLines(development?: string | null): string[] {
  if (!development?.trim()) return [];
  return [
    "Keep the time and the status of every step in the locked pillar communication.",
    "Advice, a reminder, or a step that is not yet known or not yet done stays in that status.",
    "A later line fails when it tells that step as a memory of it already having happened.",
    "If the communication exists to remind someone to do a step, a later line that says the step was already done removes the reason for the reminder and fails.",
    "A line that says andai saja aku tahu, followed by a line that says saat itu aku mulai bertanya, is that failure.",
    "A feeling, a result, or a slogan taken from the Master Thought that the locked pillar communication does not state is a new claim.",
    "A smile, or the words ibu yang baik sedunia, is a new claim when the locked pillar communication does not state them.",
  ];
}

export function pillarDevelopmentLines(development?: string | null): string[] {
  const text = development?.trim() ?? "";
  if (!text) return [];
  return [
    "Pillar development. Realize this communication. Do not replace the conceptual idea, and do not invent a different communication.",
    text,
  ];
}

export type DiscoveryMode = "follow" | "sharpen";

function discoveryInstructions(mode: DiscoveryMode): string[] {
  if (mode === "follow") {
    return [
      "Before a script is written, read the locked pillar communication.",
      "Do not write the script.",
      "Return no story question.",
      "A story question asks for a moment, a desire, a method, or how one beat becomes the next.",
      "Ask who tells the story only when the locked pillar communication does not already say who is speaking.",
      "Ask who the camera stays with only when that person can differ from the speaker and the locked pillar communication does not already say who the picture stays with.",
      "If the teller and the person in frame are the same choice, return only the viewpoint question.",
      "Do not offer an abstract option such as third person, brand, narrator, or someone, unless the option names who that is.",
      "Do not ask about duration, look, speech mode, brand spelling, the call to action, or which pillar. Those are already chosen.",
      "If the communication already names the speaker, return an empty question list.",
      'binds is "viewpoint" when the answer is who tells the story.',
      'binds is "frame" when the answer is who the camera stays with.',
    ];
  }
  return [
    "Before a video script is written, find every choice that is still open.",
    "A choice is open when two different answers would make two different scripts.",
    "Do not write the script.",
    "Read the chain from the Master Thought through the selected pillar.",
    "Name each open choice yourself. Do not limit the list to point of view.",
    "Ask who tells the story when more than one person could tell it.",
    "Ask who the camera stays with only when that person can differ from the person who tells the story.",
    "Ask any other open choice the chain does not already settle, such as which moment, or whose experience is shown.",
    "When the chain does not already say how one situation becomes the next, that join is an open choice.",
    "Ask how the viewer gets from the last moment of one beat to the first moment of the next.",
    "That question binds story. Its options are concrete steps already present in the chain.",
    "Do not leave the join to an unexplained discovery, a sudden meeting, or a promise the previous beat did not set up.",
    "A story question is allowed only when the locked pillar communication names a step and leaves its concrete instance open.",
    "Each story option is a concrete instance of that step already written in the locked pillar communication.",
    "Do not ask for a desire the communication leaves unnamed on purpose. The script asks that desire. It does not know the answer first.",
    "Do not ask for a method when the communication already states how the step is carried out.",
    "When the locked pillar communication already says how one step becomes the next, that join is closed. Do not ask it.",
    "The chosen instance fills the step that is already written. It does not become its own scene, a situation before the pillar's question, or a different method.",
    "Return as many questions as there are open choices. Zero is allowed. Five or six are allowed when each one changes the script.",
    "Each question has a short category, a prompt in the Idea's language, binds, and two to four concrete options already implied by the chain.",
    'binds is "viewpoint" when the answer is who tells the story.',
    'binds is "frame" when the answer is who the camera stays with.',
    'binds is "story" for every other open choice.',
    "If the teller and the person in frame are the same choice, return only the viewpoint question.",
    "Do not offer an abstract option such as third person, brand, narrator, or someone, unless the option names who that is.",
    "Do not ask about duration, look, speech mode, brand spelling, the call to action, or which pillar. Those are already chosen.",
    "If nothing is open, return an empty question list.",
  ];
}

export function buildExecutionConfirmPrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  priorBelief?: string;
  angleStatement?: string;
  ideaStatement: string;
  pillars: Array<{ name: string; funnel?: string | null; category?: string | null }>;
  ancestors?: AncestorStake[];
  speech?: string | null;
  look?: string | null;
  durationSeconds?: number | null;
  brandName?: string | null;
  cta?: string | null;
  pillarDevelopment?: string | null;
  discovery?: DiscoveryMode;
}): string {
  const brandName = input.brandName?.trim() ?? "";
  const cta = input.cta?.trim() ?? "";
  const pillars = input.pillars
    .map((pillar) => {
      const name = pillar.name.trim();
      if (!name) return "";
      const detail = [pillar.funnel?.trim(), pillar.category?.trim()].filter(Boolean).join(", ");
      return detail ? `- ${name} (${detail})` : `- ${name}`;
    })
    .filter(Boolean);
  return [
    ...discoveryInstructions(input.discovery ?? "sharpen"),
    "Already chosen:",
    pillars.length > 0 ? `Pillars:\n${pillars.join("\n")}` : "Pillars: (none)",
    input.speech ? `Speech mode: ${input.speech}.` : "",
    input.look ? `Look: ${input.look}.` : "",
    input.durationSeconds && input.durationSeconds > 0 ? `Duration: ${Math.round(input.durationSeconds)} seconds.` : "",
    brandName ? `Brand: ${brandName}. That team may be one option. Do not ask whether to mention the name.` : "Brand: none.",
    cta ? `Call to action: ${cta}. Do not ask about it.` : "Call to action: none.",
    "Return JSON only:",
    JSON.stringify({ questions: [{ category: "", prompt: "", binds: "viewpoint", options: ["", ""] }] }),
    "",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief:", input.priorBelief.trim()] : []),
    ...ancestorStakeBlock(input.ancestors),
    ...(input.angleStatement?.trim() ? ["", "Angle:", input.angleStatement.trim()] : []),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    ...pillarDevelopmentLines(input.pillarDevelopment),
  ]
    .filter((line) => line !== "")
    .join("\n");
}
