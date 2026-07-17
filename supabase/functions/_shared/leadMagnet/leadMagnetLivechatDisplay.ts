import { LEAD_MAGNET_PAYLOAD_PREFIX, parseLeadMagnetPostbackPayload } from "./types.ts";

export type LeadMagnetAction = "follow_confirm" | "get_framework" | "download";

const ACTION_LABELS: Record<LeadMagnetAction, string> = {
  follow_confirm: "Sudah Follow",
  get_framework: "Ambil Materi",
  download: "Unduh",
};

export function humanizeLeadMagnetAction(action: string): string | null {
  if (action === "follow_confirm" || action === "get_framework" || action === "download") {
    return ACTION_LABELS[action];
  }
  return null;
}

export function humanizeLeadMagnetPayload(payload: string): string | null {
  const parsed = parseLeadMagnetPostbackPayload(payload);
  if (!parsed) return null;
  return humanizeLeadMagnetAction(parsed.action);
}

export function resolveLeadMagnetPostbackDisplayBody(args: {
  payload?: string | null;
  title?: string | null;
  fallback?: string;
}): string {
  const title = (args.title ?? "").trim();
  if (title) return title;

  const payload = (args.payload ?? "").trim();
  const fromPayload = payload ? humanizeLeadMagnetPayload(payload) : null;
  if (fromPayload) return fromPayload;

  return args.fallback ?? "Tombol diklik";
}

export function buildLeadMagnetButtonsMetadata(buttonTitles: string[]): Record<string, unknown> {
  return {
    lead_magnet_buttons: {
      buttons: buttonTitles.map((title) => ({ title: title.trim() })).filter((b) => b.title),
    },
  };
}

export function stripLeadMagnetButtonSuffix(text: string): { body: string; buttonTitles: string[] } {
  const match = text.match(/\n\n\[Tombol:\s*(.+)\]\s*$/);
  if (!match) return { body: text, buttonTitles: [] };
  const body = text.slice(0, match.index).trimEnd();
  const buttonTitles = match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { body, buttonTitles };
}
