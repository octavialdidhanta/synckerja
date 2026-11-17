import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getDriveMediaTokenKey,
  mintDriveMediaToken,
  verifyDriveMediaToken,
} from "./driveMediaToken.ts";

const enc = new TextEncoder();
const key = enc.encode("test-secret");
const otherKey = enc.encode("other-secret");
const USER = "4ad75249-72b8-45e8-ba90-23c9868a8f64";
const FILE = "1eLD1zl7reMHz5Jjzkk3jStwVGTO-Rq39";
const NOW = 1_800_000_000_000;

Deno.test("mint + verify round trip", async () => {
  const { token, expiresAt } = await mintDriveMediaToken(key, USER, FILE, 3600, NOW);
  const res = await verifyDriveMediaToken(key, token, FILE, NOW + 1000);
  assertEquals(res, { ok: true, userId: USER, expiresAt });
  assert(!token.includes(USER), "user id must not appear in clear text");
});

Deno.test("rejects another file", async () => {
  const { token } = await mintDriveMediaToken(key, USER, FILE, 3600, NOW);
  const res = await verifyDriveMediaToken(key, token, "13Q8BY7d9XwlEkh7a14xtqhOcigYLMmeK", NOW);
  assertEquals(res, { ok: false, reason: "file_mismatch" });
});

Deno.test("rejects expired token", async () => {
  const { token } = await mintDriveMediaToken(key, USER, FILE, 60, NOW);
  const res = await verifyDriveMediaToken(key, token, FILE, NOW + 61_000);
  assertEquals(res, { ok: false, reason: "expired" });
});

Deno.test("rejects wrong signing key", async () => {
  const { token } = await mintDriveMediaToken(key, USER, FILE, 3600, NOW);
  const res = await verifyDriveMediaToken(otherKey, token, FILE, NOW);
  assertEquals(res, { ok: false, reason: "bad_signature" });
});

Deno.test("rejects tampering with file id, expiry or user", async () => {
  const { token } = await mintDriveMediaToken(key, USER, FILE, 3600, NOW);
  const [v, u, f, e, s] = token.split(".");
  const otherUser = btoa("someone-else").replace(/=+$/, "");
  for (const forged of [
    [v, u, "OTHERFILE", e, s],
    [v, u, f, String(Number(e) + 999999), s],
    [v, otherUser, f, e, s],
  ]) {
    const res = await verifyDriveMediaToken(key, forged.join("."), forged[2], NOW);
    assertEquals(res.ok, false);
  }
});

Deno.test("rejects garbage", async () => {
  for (const t of ["", "abc", "v2.a.b.1.c", "v1.a.b.notanumber.c", "v1.a.b/c.1.d"]) {
    const res = await verifyDriveMediaToken(key, t, FILE, NOW);
    assertEquals(res.ok, false);
  }
});

Deno.test("key: dedicated secret wins, else derived from service role, else null", async () => {
  const dedicated = await getDriveMediaTokenKey((n) =>
    n === "DRIVE_MEDIA_TOKEN_SECRET" ? "dedicated" : n === "SUPABASE_SERVICE_ROLE_KEY" ? "srk" : undefined
  );
  assertEquals(new TextDecoder().decode(dedicated!), "dedicated");

  const derived = await getDriveMediaTokenKey((n) => (n === "SUPABASE_SERVICE_ROLE_KEY" ? "srk" : undefined));
  assert(derived && derived.length === 32);
  assert(new TextDecoder().decode(derived) !== "srk", "service role key must not be used raw");

  assertEquals(await getDriveMediaTokenKey(() => undefined), null);
});
