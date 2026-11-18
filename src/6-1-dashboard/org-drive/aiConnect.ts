/** Helpers for the "Hubungkan AI ke Synckerja" settings page. */

export function mcpPublicOrigin(raw: string | undefined = import.meta.env.VITE_MCP_PUBLIC_URL): string {
  const origin = String(raw || "https://mcp.synckerja.com").trim().replace(/\/+$/, "");
  return origin.replace(/\/mcp$/, "");
}

/** Address the user pastes into their AI's connector settings. */
export function mcpConnectorUrl(raw?: string): string {
  return `${mcpPublicOrigin(raw)}/mcp`;
}

/** Host the user allows in their AI's network settings so it can send video files. */
export function mcpUploadHost(raw?: string): string {
  try {
    return new URL(mcpPublicOrigin(raw)).host;
  } catch {
    return "mcp.synckerja.com";
  }
}

export type AiStepState = "done" | "todo";

export function aiConnectSteps(input: {
  driveConnected: boolean;
  lastToolCallAt: string | null | undefined;
  lastUploadAt: string | null | undefined;
}): { connector: AiStepState; drive: AiStepState; upload: AiStepState } {
  return {
    connector: input.lastToolCallAt || input.lastUploadAt ? "done" : "todo",
    drive: input.driveConnected ? "done" : "todo",
    upload: input.lastUploadAt ? "done" : "todo",
  };
}

/** "baru saja", "15 menit lalu", "3 jam lalu", "2 hari lalu", or a date. */
export function relativeIdTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(then);
}
