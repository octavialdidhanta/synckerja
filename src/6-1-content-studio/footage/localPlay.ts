/** Original footage served by the Agent on this laptop. The page never picks a folder. */
export const AGENT_PLAY_ORIGIN = "http://127.0.0.1:47331";

export type AgentLink = "checking" | "on" | "off";
export type PlayProbe = "ok" | "missing" | "other-org" | "pending" | "offline";

export function footagePlayUrl(organizationId: string, fileKey: string): string {
  const q = new URLSearchParams({ org: organizationId, key: fileKey });
  return `${AGENT_PLAY_ORIGIN}/footage?${q}`;
}

export async function probeAgent(): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT_PLAY_ORIGIN}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

export async function probeFootage(organizationId: string, fileKey: string): Promise<PlayProbe> {
  try {
    const r = await fetch(footagePlayUrl(organizationId, fileKey), { headers: { Range: "bytes=0-0" } });
    void r.body?.cancel();
    if (r.status === 200 || r.status === 206) return "ok";
    if (r.status === 404) return "missing";
    if (r.status === 403) return "other-org";
    if (r.status === 503) return "pending";
    return "offline";
  } catch {
    return "offline";
  }
}
