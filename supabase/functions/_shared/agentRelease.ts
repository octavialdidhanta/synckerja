/**
 * Latest Synckerja Agent release from the private GitHub repo, as short-lived download links.
 * The GitHub token stays on the server (AGENT_RELEASE_GITHUB_TOKEN, read-only Contents on the repo);
 * laptops and browsers only ever get GitHub's pre-signed asset URL (valid a few minutes), so tenants
 * never need GitHub access and the files never pass through Synckerja.
 */

export const AGENT_REPO = "octavialdidhanta/synckerja-agent";
export const AGENT_ZIP_ASSET = "synckerja-agent-windows.zip";
export const AGENT_INSTALLER_ASSET = "Synckerja-Office.exe";

export type AgentAssetKind = "zip" | "installer";

export type AgentRelease = {
  version: string;
  publishedAt: string | null;
  zipUrl: string | null;
  installerUrl: string | null;
};

export class AgentReleaseError extends Error {
  constructor(public code: "not_configured" | "github_error" | "asset_missing", message: string) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function githubHeaders(token: string, accept: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "User-Agent": "synckerja-agent-release",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** "v0.1.4" → "0.1.4"; anything that is not x.y.z → null. */
export function releaseVersion(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const v = tag.trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

/** GitHub answers an asset download with a 302 to a pre-signed URL; that Location is what we hand out. */
async function signedAssetUrl(token: string, assetApiUrl: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(assetApiUrl, {
    headers: githubHeaders(token, "application/octet-stream"),
    redirect: "manual",
  });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location?.startsWith("https://")) return location;
  throw new AgentReleaseError("github_error", `GitHub tidak memberi link unduhan (status ${res.status}).`);
}

export async function latestAgentRelease(
  token: string,
  want: AgentAssetKind[],
  fetchImpl: FetchLike = fetch,
): Promise<AgentRelease> {
  if (!token.trim()) throw new AgentReleaseError("not_configured", "Rilis Agent belum disiapkan di server.");
  const res = await fetchImpl(`https://api.github.com/repos/${AGENT_REPO}/releases/latest`, {
    headers: githubHeaders(token, "application/vnd.github+json"),
  });
  if (!res.ok) throw new AgentReleaseError("github_error", `GitHub menolak permintaan rilis (status ${res.status}).`);
  const body = (await res.json()) as { tag_name?: unknown; published_at?: unknown; assets?: unknown };
  const version = releaseVersion(body.tag_name);
  if (!version) throw new AgentReleaseError("github_error", "Tag rilis terbaru bukan versi x.y.z.");
  const assets = Array.isArray(body.assets) ? (body.assets as Array<{ name?: unknown; url?: unknown }>) : [];
  const find = (name: string) => assets.find((a) => a.name === name && typeof a.url === "string")?.url as string | undefined;

  const out: AgentRelease = {
    version,
    publishedAt: typeof body.published_at === "string" ? body.published_at : null,
    zipUrl: null,
    installerUrl: null,
  };
  for (const kind of want) {
    const name = kind === "zip" ? AGENT_ZIP_ASSET : AGENT_INSTALLER_ASSET;
    const api = find(name);
    if (!api) throw new AgentReleaseError("asset_missing", `Rilis v${version} belum punya ${name}.`);
    const url = await signedAssetUrl(token, api, fetchImpl);
    if (kind === "zip") out.zipUrl = url;
    else out.installerUrl = url;
  }
  return out;
}
