import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AgentReleaseError, latestAgentRelease, releaseVersion } from "./agentRelease.ts";

function fakeGitHub(assets: Array<{ name: string; url: string }>, tag = "v0.1.4") {
  const calls: Array<{ url: string; accept: string | null; redirect: string | undefined }> = [];
  const impl = (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    calls.push({ url, accept: h.get("accept"), redirect: init?.redirect });
    if (url.endsWith("/releases/latest")) {
      return Promise.resolve(new Response(JSON.stringify({ tag_name: tag, published_at: "2026-11-24T01:21:00Z", assets }), { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 302, headers: { location: `https://objects.example/signed?for=${encodeURIComponent(url)}` } }));
  };
  return { impl, calls };
}

Deno.test("releaseVersion strips v and rejects non-semver tags", () => {
  assertEquals(releaseVersion("v0.1.4"), "0.1.4");
  assertEquals(releaseVersion("0.2.0"), "0.2.0");
  assertEquals(releaseVersion("Synckerja Office 0.1.0"), null);
  assertEquals(releaseVersion(undefined), null);
});

Deno.test("latestAgentRelease returns pre-signed links for the wanted assets only", async () => {
  const gh = fakeGitHub([
    { name: "synckerja-agent-windows.zip", url: "https://api.github.com/assets/1" },
    { name: "Synckerja-Office.exe", url: "https://api.github.com/assets/2" },
  ]);
  const r = await latestAgentRelease("tok", ["installer"], gh.impl);
  assertEquals(r.version, "0.1.4");
  assertEquals(r.zipUrl, null);
  assertEquals(r.installerUrl, `https://objects.example/signed?for=${encodeURIComponent("https://api.github.com/assets/2")}`);
  assertEquals(gh.calls[1].accept, "application/octet-stream");
  assertEquals(gh.calls[1].redirect, "manual");
});

Deno.test("latestAgentRelease reports a missing asset and a missing token", async () => {
  const gh = fakeGitHub([{ name: "synckerja-agent-windows.zip", url: "https://api.github.com/assets/1" }]);
  const e = await assertRejects(() => latestAgentRelease("tok", ["installer"], gh.impl), AgentReleaseError);
  assertEquals(e.code, "asset_missing");
  const n = await assertRejects(() => latestAgentRelease("  ", ["zip"], gh.impl), AgentReleaseError);
  assertEquals(n.code, "not_configured");
});
