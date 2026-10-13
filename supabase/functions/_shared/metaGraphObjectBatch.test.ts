import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fetchGraphObjectsByIds,
  graphObjectsFromBatchItems,
  objectFieldRelativeUrl,
} from "./metaGraphObjectBatch.ts";

Deno.test("objectFieldRelativeUrl requests one object and omits removed query params", () => {
  const url = objectFieldRelativeUrl("1200", "effective_status,daily_budget");
  assertEquals(url, "1200?fields=effective_status%2Cdaily_budget");
  assertEquals(url.includes("fields="), true);
  assertEquals(url.includes("ids="), false);
  assertEquals(url.includes("pretty"), false);
  assertEquals(url.includes("debug"), false);
  assertEquals(url.includes("date_format"), false);
});

Deno.test("graphObjectsFromBatchItems keeps successful bodies on the requested id", () => {
  const map = graphObjectsFromBatchItems(
    ["11", "22"],
    [
      { code: 200, body: JSON.stringify({ effective_status: "ACTIVE" }) },
      { code: 200, body: JSON.stringify({ daily_budget: "1000" }) },
    ],
  );
  assertEquals(map.get("11"), { effective_status: "ACTIVE" });
  assertEquals(map.get("22"), { daily_budget: "1000" });
});

Deno.test("graphObjectsFromBatchItems skips failed items and keeps the rest", () => {
  const map = graphObjectsFromBatchItems(
    ["11", "22", "33"],
    [
      { code: 400, body: JSON.stringify({ error: { message: "missing" } }) },
      { code: 200, body: JSON.stringify({ error: { message: "object error" } }) },
      { code: 200, body: JSON.stringify({ effective_status: "PAUSED" }) },
    ],
  );
  assertEquals([...map.keys()], ["33"]);
  assertEquals(map.get("33"), { effective_status: "PAUSED" });
});

Deno.test("fetchGraphObjectsByIds does not call Meta for an empty id list", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return Promise.resolve(Response.json([]));
  };
  try {
    const map = await fetchGraphObjectsByIds({
      graphVersion: "v22.0",
      accessToken: "token",
      ids: ["", "  "],
      fields: "id",
    });
    assertEquals(map.size, 0);
    assertEquals(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchGraphObjectsByIds posts a version-root batch without legacy params", async () => {
  const original = globalThis.fetch;
  let requestUrl = "";
  let method = "";
  let ifNoneMatch: string | null = null;
  let rawBody = "";
  globalThis.fetch = (input, init) => {
    requestUrl = String(input);
    method = init?.method ?? "";
    ifNoneMatch = new Headers(init?.headers).get("If-None-Match");
    rawBody = String(init?.body ?? "");
    return Promise.resolve(Response.json([
      { code: 200, body: JSON.stringify({ effective_status: "ACTIVE" }) },
    ]));
  };
  try {
    const map = await fetchGraphObjectsByIds({
      graphVersion: "v22.0",
      accessToken: "token-secret",
      ids: ["99"],
      fields: "effective_status",
    });
    assertEquals(requestUrl, "https://graph.facebook.com/v22.0/");
    assertEquals(method, "POST");
    assertEquals(ifNoneMatch, null);
    const params = new URLSearchParams(rawBody);
    assertEquals(params.get("access_token"), "token-secret");
    assertEquals(JSON.parse(params.get("batch") ?? "[]"), [
      { method: "GET", relative_url: "99?fields=effective_status" },
    ]);
    assertEquals(rawBody.includes("ids="), false);
    assertEquals(rawBody.includes("pretty"), false);
    assertEquals(rawBody.includes("debug"), false);
    assertEquals(rawBody.includes("date_format"), false);
    assertEquals(map.get("99"), { effective_status: "ACTIVE" });
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchGraphObjectsByIds throws when the batch response is not an array", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(Response.json({ error: { message: "nope" } }));
  try {
    await assertRejects(
      () =>
        fetchGraphObjectsByIds({
          graphVersion: "v22.0",
          accessToken: "token",
          ids: ["99"],
          fields: "id",
        }),
      Error,
      "nope",
    );
  } finally {
    globalThis.fetch = original;
  }
});
