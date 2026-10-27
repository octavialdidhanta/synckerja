/** JISDOR on 20 October 2026. */
export const USAGE_USD_IDR = 18_006;

const PER_MILLION = 1_000_000;
const FLASH_IMAGE_OUTPUT_TOKENS = 1_290;
/** Gemini 3 Pro Image 1K/2K output image token count (list price $120 / 1M). */
const PRO_IMAGE_OUTPUT_TOKENS_1K = 1_120;
const OMNI_VIDEO_TOKENS_PER_SECOND = 5_792;

export type UsageCostLine = {
  quantity: number;
  usdPerUnit: number;
  scale: number;
};

function usdToIdr(usd: number): number {
  return Math.round(usd * USAGE_USD_IDR);
}

function linesUsd(lines: UsageCostLine[]): number {
  return lines.reduce((sum, line) => sum + (line.quantity * line.usdPerUnit) / line.scale, 0);
}

function addLine(lines: UsageCostLine[], quantity: number, usdPerUnit: number, scale: number) {
  if (quantity > 0) lines.push({ quantity, usdPerUnit, scale });
}

function durationSeconds(label: string | null | undefined): number | null {
  const match = label?.match(/(\d+)\s*dtk/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

function resolution(label: string | null | undefined): string {
  return label?.toLowerCase().match(/\b(360p|480p|720p|1080p|4k)\b/)?.[1] ?? "";
}

function characterRate(model: string): { usdPerUnit: number; scale: number } | null {
  const id = model.trim().toLowerCase();
  if (id.includes("flash") || id.includes("turbo")) return { usdPerUnit: 0.04, scale: 1000 };
  // ElevenLabs TTS + STS (e.g. eleven_multilingual_sts_v2) share the same credit list price.
  if (id.startsWith("eleven_")) return { usdPerUnit: 0.08, scale: 1000 };
  return null;
}

function geminiTextRates(model: string): { input: number; output: number } | null {
  if (model === "gemini-2.5-flash") return { input: 0.3, output: 2.5 };
  if (model === "gemini-2.5-flash-lite") return { input: 0.1, output: 0.4 };
  if (model === "gemini-2.5-pro") return { input: 1.25, output: 10 };
  return null;
}

function textTokenLines(amount: number, rates: { input: number; output: number }, inputTokens: number | null | undefined, outputTokens: number | null | undefined): UsageCostLine[] {
  const hasSplit = inputTokens != null || outputTokens != null;
  if (!hasSplit) return [{ quantity: amount, usdPerUnit: rates.input, scale: PER_MILLION }];
  const lines: UsageCostLine[] = [];
  addLine(lines, inputTokens ?? 0, rates.input, PER_MILLION);
  addLine(lines, outputTokens ?? 0, rates.output, PER_MILLION);
  return lines;
}

function flashImageLines(amount: number): UsageCostLine[] {
  const lines: UsageCostLine[] = [];
  addLine(lines, Math.min(amount, FLASH_IMAGE_OUTPUT_TOKENS), 30, PER_MILLION);
  addLine(lines, amount - FLASH_IMAGE_OUTPUT_TOKENS, 0.3, PER_MILLION);
  return lines;
}

/** Gemini 3 Pro Image: image output $120/1M (1120 tok for 1K/2K), remainder billed at input $2/1M when split is unknown. */
function proImageLines(amount: number): UsageCostLine[] {
  const lines: UsageCostLine[] = [];
  addLine(lines, Math.min(amount, PRO_IMAGE_OUTPUT_TOKENS_1K), 120, PER_MILLION);
  addLine(lines, amount - PRO_IMAGE_OUTPUT_TOKENS_1K, 2, PER_MILLION);
  return lines;
}

function omniVideoLines(amount: number, label: string | null | undefined): UsageCostLine[] {
  const seconds = durationSeconds(label);
  const outputBudget = seconds == null ? amount : seconds * OMNI_VIDEO_TOKENS_PER_SECOND;
  const outputTokens = Math.min(amount, outputBudget);
  const lines: UsageCostLine[] = [];
  addLine(lines, outputTokens, 17.5, PER_MILLION);
  addLine(lines, amount - outputTokens, 1.5, PER_MILLION);
  return lines;
}

function veoUsdPerSecond(model: string, label: string | null | undefined): number | null {
  const res = resolution(label);
  if (model === "veo-3.1-generate-preview") {
    if (res === "4k") return 0.6;
    if (res === "720p" || res === "1080p" || res === "") return 0.4;
    return null;
  }
  if (model === "veo-3.1-fast-generate-preview") {
    if (res === "1080p") return 0.12;
    if (res === "4k") return 0.3;
    if (res === "720p" || res === "") return 0.1;
    return null;
  }
  if (model === "veo-3.1-lite-generate-preview") {
    if (res === "1080p") return 0.08;
    if (res === "720p" || res === "") return 0.05;
    return null;
  }
  return null;
}

export function usageCostLines(input: {
  model: string | null;
  amount: number | null;
  unit: "character" | "token" | null;
  targetLabel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): UsageCostLine[] | null {
  const amount = input.amount;
  const model = input.model?.trim() ?? "";
  if (amount == null || amount < 0 || !model) return null;
  if (input.unit === "character") {
    const rate = characterRate(model);
    return rate ? [{ quantity: amount, usdPerUnit: rate.usdPerUnit, scale: rate.scale }] : null;
  }
  if (input.unit !== "token") return null;
  if (model === "gemini-2.5-flash-image") return flashImageLines(amount);
  if (model === "gemini-3-pro-image-preview" || model === "gemini-3-pro-image") return proImageLines(amount);
  const textRates = geminiTextRates(model);
  if (textRates) return textTokenLines(amount, textRates, input.inputTokens, input.outputTokens);
  if (model === "gemini-omni-1.1-flash" || model === "gemini-omni-flash-preview") return omniVideoLines(amount, input.targetLabel);
  const perSecond = veoUsdPerSecond(model, input.targetLabel);
  const seconds = durationSeconds(input.targetLabel);
  if (perSecond != null && seconds != null) return [{ quantity: seconds, usdPerUnit: perSecond, scale: 1 }];
  return null;
}

export function mergeUsageCostLines(groups: Array<UsageCostLine[] | null>): UsageCostLine[] {
  const merged: UsageCostLine[] = [];
  for (const lines of groups) {
    if (!lines) continue;
    for (const line of lines) {
      const found = merged.find((item) => item.usdPerUnit === line.usdPerUnit && item.scale === line.scale);
      if (found) found.quantity += line.quantity;
      else merged.push({ ...line });
    }
  }
  return merged;
}

export function formatUsageCostDetail(lines: UsageCostLine[]): string {
  if (lines.length === 0) return "";
  const parts = lines.map((line) => {
    const whole = Number.isInteger(line.usdPerUnit);
    const rate = line.usdPerUnit.toLocaleString("en-US", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    });
    const quantity = line.quantity.toLocaleString("id-ID");
    if (line.scale === 1) return `${quantity} × $${rate}`;
    return `${quantity} × $${rate}/${line.scale.toLocaleString("id-ID")}`;
  });
  return `${parts.join(" + ")} × Rp${USAGE_USD_IDR.toLocaleString("id-ID")}`;
}

export function usageCostIdr(input: {
  model: string | null;
  amount: number | null;
  unit: "character" | "token" | null;
  targetLabel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  const lines = usageCostLines(input);
  return lines ? usdToIdr(linesUsd(lines)) : null;
}
