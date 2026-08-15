/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fbclidCapturedAtToEpoch,
  leadFbclidCapturePatch,
  mergeAttributionWithFbclidCapture,
  resolveFbclidCapturedAtIso,
} from "./fbclidCapture.ts";
import { buildFbcFromFbclid } from "./metaAdsCapiHelpers.ts";

Deno.test("buildFbcFromFbclid uses explicit click epoch", () => {
  assertEquals(
    buildFbcFromFbclid("testclid", 1710000000),
    "fb.1.1710000000.testclid",
  );
});

Deno.test("buildFbcFromFbclid returns undefined without valid epoch", () => {
  assertEquals(buildFbcFromFbclid("testclid", null), undefined);
  assertEquals(buildFbcFromFbclid("testclid"), undefined);
  assertEquals(buildFbcFromFbclid("testclid", 0), undefined);
});

Deno.test("resolveFbclidCapturedAtIso prefers column over attribution and session", () => {
  assertEquals(
    resolveFbclidCapturedAtIso({
      columnCapturedAt: "2026-06-01T10:00:00.000Z",
      attribution: { fbclid_captured_at: "2026-06-02T10:00:00.000Z" },
      sessionCapturedAt: "2026-06-03T10:00:00.000Z",
      sessionStartedAt: "2026-06-04T10:00:00.000Z",
      sessionFbclid: "fb-1",
      leadCreatedAt: "2026-06-05T10:00:00.000Z",
    }),
    "2026-06-01T10:00:00.000Z",
  );

  assertEquals(
    resolveFbclidCapturedAtIso({
      attribution: { fbclid_captured_at: "2026-06-02T10:00:00.000Z" },
      sessionCapturedAt: "2026-06-03T10:00:00.000Z",
    }),
    "2026-06-02T10:00:00.000Z",
  );

  assertEquals(
    resolveFbclidCapturedAtIso({
      sessionCapturedAt: "2026-06-03T10:00:00.000Z",
      sessionStartedAt: "2026-06-04T10:00:00.000Z",
      sessionFbclid: "fb-1",
    }),
    "2026-06-03T10:00:00.000Z",
  );

  assertEquals(
    resolveFbclidCapturedAtIso({
      sessionStartedAt: "2026-06-04T10:00:00.000Z",
      sessionFbclid: "fb-1",
      leadCreatedAt: "2026-06-05T10:00:00.000Z",
    }),
    "2026-06-04T10:00:00.000Z",
  );

  assertEquals(
    resolveFbclidCapturedAtIso({
      leadCreatedAt: "2026-06-05T10:00:00.000Z",
    }),
    "2026-06-05T10:00:00.000Z",
  );
});

Deno.test("fbclidCapturedAtToEpoch converts ISO to unix seconds", () => {
  const iso = "2026-06-21T10:00:00.000Z";
  assertEquals(
    fbclidCapturedAtToEpoch(iso),
    Math.floor(Date.parse(iso) / 1000),
  );
});

Deno.test("mergeAttributionWithFbclidCapture sets fbclid and first-touch timestamp", () => {
  const merged = mergeAttributionWithFbclidCapture(
    { utm_source: "meta" },
    "fb-abc",
    "2026-06-21T10:00:00.000Z",
  );
  assertEquals(merged.fbclid, "fb-abc");
  assertEquals(merged.fbclid_captured_at, "2026-06-21T10:00:00.000Z");
  assertEquals(merged.utm_source, "meta");
});

Deno.test("mergeAttributionWithFbclidCapture does not overwrite existing captured_at", () => {
  const merged = mergeAttributionWithFbclidCapture(
    { fbclid_captured_at: "2026-06-01T08:00:00.000Z" },
    "fb-new",
    "2026-06-21T10:00:00.000Z",
  );
  assertEquals(merged.fbclid, "fb-new");
  assertEquals(merged.fbclid_captured_at, "2026-06-01T08:00:00.000Z");
});

Deno.test("leadFbclidCapturePatch first-touch only", () => {
  const patch = leadFbclidCapturePatch({
    existingFbclid: null,
    existingCapturedAt: null,
    incomingFbclid: "fb-1",
    sessionCapturedAt: "2026-06-21T09:00:00.000Z",
    nowIso: "2026-06-21T10:00:00.000Z",
  });
  assertEquals(patch.fbclid, "fb-1");
  assertEquals(patch.fbclid_captured_at, "2026-06-21T09:00:00.000Z");

  const noop = leadFbclidCapturePatch({
    existingFbclid: "fb-old",
    existingCapturedAt: "2026-06-01T08:00:00.000Z",
    incomingFbclid: "fb-new",
    nowIso: "2026-06-21T10:00:00.000Z",
  });
  assertEquals(Object.keys(noop).length, 0);
});
