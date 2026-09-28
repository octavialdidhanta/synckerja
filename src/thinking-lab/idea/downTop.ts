import { parseModelJson } from "@/thinking-lab/shared/ai";

export type IdeaViewerClimb = "CLIMBS" | "OTHER" | "NEGATIVE" | "UNRESOLVED";
export type IdeaSubjectMatch = "MATCH" | "OTHER" | "UNRESOLVED";
export type IdeaProofState = true | false | "unresolved";
export type IdeaDownTopVerdict = "PASS" | "FAIL" | "UNRESOLVED";

export type IdeaDownTopItem = {
  code: string;
  viewerClimb: IdeaViewerClimb;
  subjectMatch: IdeaSubjectMatch;
  proofCanAppear: IdeaProofState;
  bigThoughtNote: string;
  verdict: IdeaDownTopVerdict;
};

const CLIMBS = ["CLIMBS", "OTHER", "NEGATIVE", "UNRESOLVED"] as const;
const MATCHES = ["MATCH", "OTHER", "UNRESOLVED"] as const;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asClimb(value: unknown): IdeaViewerClimb {
  if (typeof value !== "string") return "UNRESOLVED";
  const match = CLIMBS.find((item) => item === value.trim());
  return match ?? "UNRESOLVED";
}

function asMatch(value: unknown): IdeaSubjectMatch {
  if (typeof value !== "string") return "UNRESOLVED";
  const match = MATCHES.find((item) => item === value.trim());
  return match ?? "UNRESOLVED";
}

function asProof(value: unknown): IdeaProofState {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return "unresolved";
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return "unresolved";
}

export function scoreDownTopItem(input: {
  code: string;
  viewerClimb: IdeaViewerClimb;
  subjectMatch: IdeaSubjectMatch;
  proofCanAppear: IdeaProofState;
  bigThoughtNote: string;
}): IdeaDownTopItem {
  const note = input.bigThoughtNote.trim();
  const row = { ...input, bigThoughtNote: note };
  if (input.viewerClimb === "OTHER" || input.viewerClimb === "NEGATIVE" || input.subjectMatch === "OTHER") {
    return { ...row, verdict: "FAIL" };
  }
  if (input.viewerClimb !== "CLIMBS" || input.subjectMatch !== "MATCH" || input.proofCanAppear === "unresolved") {
    return { ...row, verdict: "UNRESOLVED" };
  }
  if (input.proofCanAppear === false) {
    return { ...row, verdict: note ? "FAIL" : "UNRESOLVED" };
  }
  return { ...row, verdict: "PASS" };
}

export function normalizeIdeaDownTop(raw: unknown, codes: string[], subjectSealed = true): IdeaDownTopItem[] {
  const rows =
    raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { items?: unknown }).items)
      ? ((raw as { items: unknown[] }).items ?? [])
      : null;
  return codes.map((code) => {
    const found = rows?.find((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      return asText((row as { code?: unknown }).code).toUpperCase() === code.toUpperCase();
    }) as Record<string, unknown> | undefined;
    if (!found) {
      return scoreDownTopItem({
        code,
        viewerClimb: "UNRESOLVED",
        subjectMatch: "UNRESOLVED",
        proofCanAppear: "unresolved",
        bigThoughtNote: "",
      });
    }
    const subjectMatch = subjectSealed ? asMatch(found.subjectMatch) : "UNRESOLVED";
    return scoreDownTopItem({
      code,
      viewerClimb: asClimb(found.viewerClimb),
      subjectMatch,
      proofCanAppear: asProof(found.proofCanAppear),
      bigThoughtNote: asText(found.bigThoughtNote),
    });
  });
}

export function parseIdeaDownTop(script: string | null, codes: string[], subjectSealed = true): IdeaDownTopItem[] {
  if (!script?.trim()) {
    return codes.map((code) =>
      scoreDownTopItem({
        code,
        viewerClimb: "UNRESOLVED",
        subjectMatch: "UNRESOLVED",
        proofCanAppear: "unresolved",
        bigThoughtNote: "",
      }),
    );
  }
  return normalizeIdeaDownTop(parseModelJson(script), codes, subjectSealed);
}

export function buildIdeaDownTopPrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  bigThoughtStatement: string;
  angleStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const subject = input.masterSubject?.trim() || "(not sealed)";
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You test each admitted Idea from the audience upward.",
    "Imagine a viewer who sees only that Idea, not the Angle, Big Thought, or Master Thought.",
    "viewerClimb is CLIMBS when the only plausible conclusion rises to this Angle, then this Big Thought, then this Master Thought.",
    "The Idea does not have to say the subject's name. The subject becomes visible as the cause when the conclusion reaches the Master Thought.",
    "viewerClimb is OTHER when the viewer reaches a different conclusion.",
    "viewerClimb is NEGATIVE when the viewer reaches an unwanted negative conclusion.",
    "viewerClimb is UNRESOLVED when the climb cannot be decided.",
    "subjectMatch is MATCH when that Master Thought conclusion is about the named subject. OTHER when it is about a different subject. UNRESOLVED when that cannot be decided. When the subject is not sealed, use UNRESOLVED.",
    "proofCanAppear is true when the situation can actually show the proof. false when the proof cannot appear. unresolved when that cannot be decided.",
    "When proofCanAppear is false, bigThoughtNote must name this Big Thought and say why it should be questioned. Otherwise leave bigThoughtNote empty.",
    "Do not decide a pass or fail. The code owns that verdict.",
    "Use exactly the keys code, viewerClimb, subjectMatch, proofCanAppear, and bigThoughtNote.",
    "Write notes in the same language as the Idea.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      items: [
        {
          code: "ID01",
          viewerClimb: "UNRESOLVED",
          subjectMatch: "UNRESOLVED",
          proofCanAppear: "unresolved",
          bigThoughtNote: "",
        },
      ],
    }),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    "",
    "Master Thought subject:",
    subject,
    "",
    "Big Thought:",
    input.bigThoughtStatement.trim(),
    "",
    "Direct Angle:",
    input.angleStatement.trim(),
    "",
    "Admitted Ideas:",
    lines,
  ].join("\n");
}
