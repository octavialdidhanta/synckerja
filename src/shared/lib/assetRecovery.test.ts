import { describe, expect, it, vi } from "vitest";
import { canReloadAt, failedChunkUrl, importedChunkUrls, parseReloads, refreshChunkCache, WINDOW_MS } from "./assetRecovery";

describe("asset recovery", () => {
  it("allows at most two reloads per window, so it cannot loop", () => {
    const now = 1_000_000;
    expect(canReloadAt([], now)).toBe(true);
    expect(canReloadAt([now - 3000], now)).toBe(true);
    expect(canReloadAt([now - 6000, now - 3000], now)).toBe(false);
    expect(canReloadAt([now - WINDOW_MS - 1, now - 3000], now)).toBe(true);
    expect(parseReloads("not json")).toEqual([]);
  });

  it("finds the failed chunk and the chunks it imports", () => {
    const url = "https://office.synckerja.com/assets/ObjectivesTab-hzjEB5it.js";
    expect(failedChunkUrl(`Failed to fetch dynamically imported module: ${url}`)).toBe(url);
    expect(failedChunkUrl("TypeError: something else")).toBeNull();
    expect(importedChunkUrls(url, 'import{a}from"./index.esm-h-bZGG46.js";import("./App-eD3uultv.js")')).toEqual([
      "https://office.synckerja.com/assets/index.esm-h-bZGG46.js",
      "https://office.synckerja.com/assets/App-eD3uultv.js",
    ]);
  });

  it("refetches the chunk and its imports past the HTTP cache", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fake = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push([u, init]);
      return new Response(u.endsWith("Tab-1.js") ? 'import"./dep-2.js"' : "", { status: 200 });
    }) as unknown as typeof fetch;
    await refreshChunkCache("https://x.test/assets/Tab-1.js", fake);
    expect(calls.map(([u, i]) => [u, i?.cache])).toEqual([
      ["https://x.test/assets/Tab-1.js", "reload"],
      ["https://x.test/assets/dep-2.js", "reload"],
    ]);
  });
});
