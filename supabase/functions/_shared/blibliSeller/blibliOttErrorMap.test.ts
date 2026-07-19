import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapBlibliOttErrorCode } from "./blibliOttErrorMap.ts";

Deno.test("mapBlibliOttErrorCode — known Blibli codes", () => {
  assertEquals(
    mapBlibliOttErrorCode({
      ok: false,
      status: 400,
      errorCode: "ERR-PA400054",
      errorMessage: "unbound",
      requestId: "r1",
    }),
    "STORE_UNBOUND",
  );
  assertEquals(
    mapBlibliOttErrorCode({
      ok: false,
      status: 500,
      errorCode: "ERR-MA500007",
      errorMessage: "server",
      requestId: "r2",
    }),
    "BLIBLI_SERVER_ERROR",
  );
  assertEquals(
    mapBlibliOttErrorCode({
      ok: false,
      status: 401,
      errorCode: null,
      errorMessage: "unauthorized",
      requestId: "r3",
    }),
    "AUTH_FAILED",
  );
});
