const BECAUSE_START = /^(karena|because)\b[:\s]*/i;

function stripEndPunctuation(value: string): string {
  return value.trim().replace(/[.。]+$/g, "").trim();
}

export function becauseConnector(text: string): "karena" | "because" {
  if (/\b(yang|untuk|adalah|lebih|daripada|dengan|tidak|nggak|ini|itu|dan)\b/i.test(text)) return "karena";
  return "because";
}

export function asBecauseClause(statement: string, parentStatement = ""): string {
  let text = statement.trim();
  const parent = stripEndPunctuation(parentStatement);
  let stripped = false;
  if (parent && text.toLowerCase().startsWith(parent.toLowerCase())) {
    text = text.slice(parent.length).trim();
    stripped = true;
  }
  if (/^[,;:\-–—]/.test(text)) {
    text = text.replace(/^[,;:\-–—]+\s*/, "");
    stripped = true;
  }
  if (BECAUSE_START.test(text)) {
    text = text.replace(BECAUSE_START, "");
    stripped = true;
  }
  return stripped ? stripEndPunctuation(text) : text.trim();
}

export const BECAUSE_RESULT_LINES = [
  "When the cause alone does not yet show the result that makes the Master Thought feel true, continue that same clause with one result of the cause. Join it with sehingga when the Master Thought is Indonesian, and with so that when it is English.",
  "That result is what the cause produces. It must not repeat the Master Thought, and it must not open a second reason.",
  "When the cause already shows that result, stop. Do not add sehingga or so that.",
] as const;

export function becauseSentence(parentStatement: string, clause: string): string {
  const parent = stripEndPunctuation(parentStatement);
  const reason = stripEndPunctuation(asBecauseClause(clause, parentStatement));
  if (!parent || !reason) return clause.trim();
  const comma = /[,;:]$/.test(parent) ? "" : ",";
  return `${parent}${comma} ${becauseConnector(parent)} ${reason}.`;
}
