/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeIncomingAttribution } from "./urlParams.ts";

const ctx = {
  now: "2026-06-21T10:00:00.000Z",
  pageUrl: "https://example.com/contact",
  referrer: null,
  visitorId: "00000000-0000-4000-8000-000000000001",
};

Deno.test("mergeIncomingAttribution keeps UTM when incoming is empty", () => {
  const patch = mergeIncomingAttribution(
    {
      utm_source: "test_dev",
      first_utm_source: "test_dev",
      last_utm_source: "test_dev",
      has_gclid: true,
      first_has_gclid: true,
      last_has_gclid: true,
    },
    {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: null,
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/contact",
    },
    ctx,
  );

  assertEquals(patch.last_utm_source, "test_dev");
  assertEquals(patch.has_gclid, true);
  assertEquals(patch.last_has_gclid, true);
  assertEquals(patch.utm_source, undefined);
});

Deno.test("mergeIncomingAttribution backfills first-touch when existing is empty", () => {
  const patch = mergeIncomingAttribution(
    {},
    {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: null,
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/",
    },
    { ...ctx, pageUrl: "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring" },
  );

  assertEquals(patch.utm_source, "google");
  assertEquals(patch.first_utm_source, "google");
  assertEquals(patch.last_utm_source, "google");
  assertEquals(patch.last_utm_medium, "cpc");
});

Deno.test("mergeIncomingAttribution updates last-touch only when incoming UTM present", () => {
  const patch = mergeIncomingAttribution(
    {
      utm_source: "google",
      first_utm_source: "google",
      last_utm_source: "google",
      utm_medium: "cpc",
      first_utm_medium: "cpc",
      last_utm_medium: "cpc",
    },
    {
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: null,
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/promo",
    },
    { ...ctx, pageUrl: "https://example.com/promo?utm_source=newsletter&utm_medium=email" },
  );

  assertEquals(patch.utm_source, undefined);
  assertEquals(patch.last_utm_source, "newsletter");
  assertEquals(patch.last_utm_medium, "email");
});

Deno.test("mergeIncomingAttribution sets fbclid_captured_at on first fbclid", () => {
  const patch = mergeIncomingAttribution(
    {},
    {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: "fb-first",
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/",
    },
    { ...ctx, pageUrl: "https://example.com/?fbclid=fb-first" },
  );

  assertEquals(patch.fbclid, "fb-first");
  assertEquals(patch.fbclid_captured_at, ctx.now);
});

Deno.test("mergeIncomingAttribution does not overwrite fbclid_captured_at", () => {
  const patch = mergeIncomingAttribution(
    {
      fbclid: "fb-old",
      fbclid_captured_at: "2026-06-01T08:00:00.000Z",
    },
    {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: "fb-new",
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/",
    },
    ctx,
  );

  assertEquals(patch.fbclid, "fb-new");
  assertEquals(patch.fbclid_captured_at, undefined);
});

Deno.test("mergeIncomingAttribution without fbclid does not set captured_at", () => {
  const patch = mergeIncomingAttribution(
    {},
    {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: null,
      msclkid: null,
      gbraid: null,
      wbraid: null,
      path: "/",
    },
    ctx,
  );

  assertEquals(patch.fbclid_captured_at, undefined);
});
