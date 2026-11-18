import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptOrgDriveToken, encryptOrgDriveToken, orgDriveEncryptionKeyRaw } from "./crypto.ts";

const KEY_HEX = "a".repeat(64);
const OTHER_HEX = "b".repeat(64);

Deno.test("encrypt/decrypt round trip with a random IV", async () => {
  const a = await encryptOrgDriveToken("1//refresh-token", KEY_HEX);
  const b = await encryptOrgDriveToken("1//refresh-token", KEY_HEX);
  assertEquals(a === b, false);
  assertEquals(await decryptOrgDriveToken(a, KEY_HEX), "1//refresh-token");
});

Deno.test("wrong key fails", async () => {
  const enc = await encryptOrgDriveToken("secret", KEY_HEX);
  await assertRejects(() => decryptOrgDriveToken(enc, OTHER_HEX));
});

Deno.test("key fallback order", () => {
  const env = (m: Record<string, string>) => (n: string) => m[n];
  assertEquals(orgDriveEncryptionKeyRaw(env({ GOOGLE_ADS_CONFIG_ENCRYPTION_KEY: "ads" })), "ads");
  assertEquals(
    orgDriveEncryptionKeyRaw(env({ GOOGLE_ADS_CONFIG_ENCRYPTION_KEY: "ads", GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY: "c" })),
    "c",
  );
  assertEquals(
    orgDriveEncryptionKeyRaw(env({ GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY: "c", GOOGLE_DRIVE_ORG_ENCRYPTION_KEY: "d" })),
    "d",
  );
  assertEquals(orgDriveEncryptionKeyRaw(env({})), "");
});
