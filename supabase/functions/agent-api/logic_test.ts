/// <reference lib="deno.ns" />
import { deepStrictEqual as assertEquals } from "node:assert";
import {
  extractAgentToken,
  mapRpcError,
  parseAuthRow,
  parseFileKeys,
  parseHeartbeat,
  parseMediaDone,
  routePath,
  sha256Hex,
  versionOlderThan,
} from "./logic.ts";

const TOKEN = "sk_agent_d7e26bf5_d0f976f02de1da33970762164b0fab9a76976c1bc4872210";
const DEVICE = "11111111-1111-1111-1111-111111111111";

Deno.test("extractAgentToken accepts only well-formed agent tokens", () => {
  assertEquals(extractAgentToken(`Bearer ${TOKEN}`), TOKEN);
  assertEquals(extractAgentToken(null), null);
  assertEquals(extractAgentToken(TOKEN), null);
  assertEquals(extractAgentToken("Bearer sk_omni_abc"), null);
  assertEquals(extractAgentToken(`Bearer ${TOKEN}x`), null);
});

Deno.test("sha256Hex matches Postgres digest(..., 'sha256')", async () => {
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("routePath strips the function prefix", () => {
  assertEquals(routePath("/functions/v1/agent-api/v1/heartbeat"), "/v1/heartbeat");
  assertEquals(routePath("/agent-api/v1/whoami/"), "/v1/whoami");
  assertEquals(routePath("/agent-api"), "/");
});

Deno.test("parseAuthRow keeps known scopes only", () => {
  assertEquals(parseAuthRow(null), null);
  assertEquals(parseAuthRow({ token_id: "t", organization_id: "o", scopes: ["catalog", "admin"] })?.scopes, ["catalog"]);
});

Deno.test("parseHeartbeat validates the device and trims text", () => {
  const ok = parseHeartbeat({ device_name: " Laptop Aldi ", agent_version: "0.1.0", tools: { ffmpeg: { ok: true } } }, DEVICE);
  assertEquals(ok.ok && ok.value.name, "Laptop Aldi");
  assertEquals(ok.ok && ok.value.platform, null);
  assertEquals(parseHeartbeat({ device_name: "x" }, "nope").ok, false);
  assertEquals(parseHeartbeat({ device_name: "" }, DEVICE).ok, false);
  assertEquals(parseHeartbeat({ device_name: "x", tools: [] }, DEVICE).ok, false);
  assertEquals(parseHeartbeat({ device_name: "x", agent_version: 3 }, DEVICE).ok, false);
  assertEquals(parseHeartbeat({ device_name: "x", tools: { big: "a".repeat(30_000) } }, DEVICE).ok, false);
  assertEquals(parseHeartbeat([], DEVICE).ok, false);
});

Deno.test("footage request parsers", () => {
  assertEquals(parseFileKeys({ file_keys: ["INBOX/a.mp4"] }), ["INBOX/a.mp4"]);
  assertEquals(parseFileKeys({ file_keys: [1] }), null);
  assertEquals(parseFileKeys({}), null);
  assertEquals(parseMediaDone({ asset_id: DEVICE, preview: true, scene_ids: [DEVICE] }), {
    assetId: DEVICE,
    preview: true,
    sceneIds: [DEVICE],
  });
  assertEquals(parseMediaDone({ asset_id: DEVICE })?.sceneIds, []);
  assertEquals(parseMediaDone({ asset_id: "x" }), null);
  assertEquals(parseMediaDone({ asset_id: DEVICE, scene_ids: ["x"] }), null);
  assertEquals(mapRpcError("ERROR: file_key_taken"), { status: 409, code: "file_key_taken" });
  assertEquals(mapRpcError("boom").status, 500);
});

Deno.test("version floor stays open until a self-updating release is installed", () => {
  assertEquals(versionOlderThan("0.1.10", "0.0.0"), false);
  assertEquals(versionOlderThan(null, "0.0.0"), false);
  assertEquals(versionOlderThan("0.1.11", "0.1.12"), true);
  assertEquals(versionOlderThan("v0.1.12", "0.1.12"), false);
  assertEquals(versionOlderThan("0.2.0", "0.1.12"), false);
  assertEquals(versionOlderThan(null, "0.1.12"), true);
  assertEquals(versionOlderThan("bukan-versi", "0.1.12"), true);
});
