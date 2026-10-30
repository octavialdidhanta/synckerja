import {
  claudeOutlineText,
  materialOutlineRejectReason,
  nextPdfTurn,
  parseMaterialOutline,
  type MaterialOutline,
} from "./materialOutline.ts";

const ANTHROPIC_MESSAGES = "https://api.anthropic.com/v1/messages";
const PDF_BETA = "code-execution-2025-08-25,skills-2025-10-02,files-api-2025-04-14";
const FILES_BETA = "files-api-2025-04-14";
const PDF_TOOL = { type: "code_execution_20260521", name: "code_execution" } as const;
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";

const CLAUDE_MODEL_REPLACEMENTS: Record<string, string> = {
  "claude-sonnet-4-5": DEFAULT_CLAUDE_MODEL,
  "claude-sonnet-4-5-20250929": DEFAULT_CLAUDE_MODEL,
  "claude-opus-4-5": "claude-opus-5-5",
  "claude-opus-4-5-20251101": "claude-opus-5-5",
  "claude-haiku-4-5": "claude-haiku-5-5",
  "claude-haiku-4-5-20251001": "claude-haiku-5-5",
};

export function normalizeClaudeModel(raw: string | null | undefined): string {
  const model = String(raw ?? "").trim();
  const mapped = CLAUDE_MODEL_REPLACEMENTS[model] ?? model;
  if (/^claude-[a-z0-9._-]{3,80}$/i.test(mapped)) return mapped;
  return DEFAULT_CLAUDE_MODEL;
}

function modelRequestFields(model: string): Record<string, unknown> {
  if (model !== "claude-sonnet-5-5") return {};
  return {
    thinking: { type: "between_tools" },
    output_config: { effort: "medium" },
  };
}

async function claudePost(
  apiKey: string,
  body: Record<string, unknown>,
  beta: string | null,
  timeoutMs: number,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (beta) headers["anthropic-beta"] = beta;
  const res = await fetch(ANTHROPIC_MESSAGES, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `Claude request failed (${res.status})`);
  }
  return json;
}

export async function requestMaterialOutline(input: {
  apiKey: string;
  model: string;
  offer: string;
  trigger: string;
  pillarName: string;
  development: string;
}): Promise<{ outline: MaterialOutline | null; reason: string }> {
  const payload = await claudePost(input.apiKey, {
    model: input.model,
    max_tokens: 8000,
    ...modelRequestFields(input.model),
    messages: [{
      role: "user",
      content: [
        "Tulis panduan belajar bahasa Indonesia yang bisa dipraktikkan tanpa menonton video lagi. JSON saja, tanpa markdown.",
        "Tetap di dalam offer dan trigger. Jangan menambah topik, framework, atau kata kunci komentar baru.",
        "display_title maksimal 8 kata, tanpa titik di akhir. Ini judul halaman, bukan kalimat offer.",
        "intro dua paragraf, minimal 400 karakter: apa yang dikuasai pembaca, lalu kesalahan yang biasa terjadi.",
        "sections tepat 4. Setiap bagian adalah satu langkah yang videonya sengaja tidak ajarkan.",
        "heading maksimal 8 kata. body dua paragraf, minimal 500 karakter, berisi urutan cara melakukan dan hal yang harus dihindari.",
        "example adalah kalimat, pertanyaan, atau hitungan yang bisa langsung disalin. Minimal 80 karakter.",
        "Jangan meringkas jadi satu kalimat. Jangan mengulang kalimat offer sebagai isi.",
        "button_label maksimal 20 karakter.",
        "replies tepat 3 balasan komentar yang berbeda, mengarah ke offer, dan menyuruh cek DM.",
        "",
        `offer: ${JSON.stringify(input.offer)}`,
        `trigger: ${JSON.stringify(input.trigger)}`,
        `pillar: ${JSON.stringify(input.pillarName)}`,
        `development: ${JSON.stringify(input.development.slice(0, 2000))}`,
        "",
        '{"display_title":"","intro":"","button_label":"","sections":[{"heading":"","body":"","example":""}],"replies":["","",""]}',
      ].join("\n"),
    }],
  }, null, 45000);
  const text = claudeOutlineText(payload);
  const outline = parseMaterialOutline(text, input.offer);
  if (outline) return { outline, reason: "" };
  const stop = payload && typeof payload === "object"
    ? String((payload as { stop_reason?: unknown }).stop_reason ?? "").trim()
    : "";
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 180);
  const reason = [materialOutlineRejectReason(text, input.offer), stop, snippet].filter(Boolean).join(": ");
  return { outline: null, reason };
}

export async function renderOutlinePdf(input: {
  apiKey: string;
  model: string;
  outline: MaterialOutline;
}): Promise<Uint8Array> {
  const skills = [{ type: "anthropic", skill_id: "pdf", version: "latest" }];
  const messages: Array<{ role: string; content: unknown }> = [{
    role: "user",
    content: [
      "Use the PDF skill to design a 2 to 3 page study guide. Use only the text in the JSON. Do not invent chapters.",
      "A4 page, 18mm margins, Helvetica.",
      "Body is 11pt regular, leading 16, black. Never bold a paragraph.",
      "The page heading is display_title at 20pt bold, at most two lines.",
      "Under it, put title at 10.5pt regular in #444444. title is the offer sentence. Never render title larger than the body and never in bold.",
      "Then intro as normal paragraphs.",
      "For each section: a small gray label 01, 02, 03, 04, then heading at 13pt bold, then body, then a full-width box filled #F4F4F5 with 8pt padding. Inside the box, a 9pt bold label Contoh and the example text at 11pt regular.",
      "Leave 16pt between sections. Keep every line inside the margins. No images. Footer is the page number, 9pt gray, centered.",
      "When the PDF is ready, leave the file in the tool result.",
      "",
      JSON.stringify({
        display_title: input.outline.displayTitle,
        title: input.outline.title,
        intro: input.outline.intro,
        sections: input.outline.sections,
      }),
    ].join("\n"),
  }];
  let container: { id?: string; skills: typeof skills } = { skills };
  let payload: unknown = null;
  const deadline = Date.now() + 100000;
  for (let turn = 0; turn < 4; turn += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 5000) break;
    payload = await claudePost(input.apiKey, {
      model: input.model,
      max_tokens: 16000,
      ...modelRequestFields(input.model),
      container,
      tools: [PDF_TOOL],
      messages,
    }, PDF_BETA, Math.min(45000, remaining));
    const step = nextPdfTurn(payload);
    if (step.kind === "file") break;
    if (step.kind === "continue") {
      messages.push({ role: "assistant", content: step.content });
      container = { id: step.containerId, skills };
      continue;
    }
    throw new Error(`Claude did not return a PDF file (${step.reason})`);
  }

  const finished = nextPdfTurn(payload);
  const fileId = finished.kind === "file" ? finished.fileId : null;
  if (!fileId) throw new Error("Claude did not return a PDF file");

  const res = await fetch(`https://api.anthropic.com/v1/files/${encodeURIComponent(fileId)}/content`, {
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": FILES_BETA,
    },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 240) || `Claude file download failed (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (!header.startsWith("%PDF") || bytes.byteLength < 32) {
    throw new Error("Claude file is not a PDF");
  }
  return bytes;
}
