/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deriveApiLeadCrmFields,
  humanizeWebId,
  isFloatingWaLeadSource,
  isLegacyApiLeadRow,
  pathFromLandingUrl,
  API_LEAD_SOURCE_WEBSITE_FORM,
  API_LEAD_SOURCE_WHATSAPP_BUTTON,
  API_LEAD_CREATED_BY_NAME,
} from "./apiLeadCrmFields.ts";

Deno.test("deriveApiLeadCrmFields uses package_label for website form title", () => {
  const fields = deriveApiLeadCrmFields({
    webId: "vialdi",
    channel: "website_form",
    formData: { package_label: "Wedding Premium" },
  });
  assertEquals(fields.title, "Inquiry — Wedding Premium");
  assertEquals(fields.source, API_LEAD_SOURCE_WEBSITE_FORM);
  assertEquals(fields.created_by_name, API_LEAD_CREATED_BY_NAME);
});

Deno.test("deriveApiLeadCrmFields respects overrides", () => {
  const fields = deriveApiLeadCrmFields({
    webId: "vialdi",
    channel: "website_form",
    overrides: {
      title: "Custom title",
      category: "Custom cat",
      source_label: "Landing page",
    },
    formData: { package_label: "Ignored for title" },
  });
  assertEquals(fields.title, "Custom title");
  assertEquals(fields.category, "Custom cat");
  assertEquals(fields.source, "Landing page");
});

Deno.test("deriveApiLeadCrmFields whatsapp button uses path", () => {
  const fields = deriveApiLeadCrmFields({
    webId: "vialdi",
    channel: "whatsapp_button",
    clickPath: "/contact",
  });
  assertEquals(fields.title, "WhatsApp click · /contact");
  assertEquals(fields.source, API_LEAD_SOURCE_WHATSAPP_BUTTON);
});

Deno.test("humanizeWebId and pathFromLandingUrl", () => {
  assertEquals(humanizeWebId("vialdi-wedding"), "Vialdi Wedding");
  assertEquals(pathFromLandingUrl("http://localhost:8080/contact"), "/contact");
});

Deno.test("isFloatingWaLeadSource accepts legacy and new", () => {
  assertEquals(isFloatingWaLeadSource("WhatsApp floating click"), true);
  assertEquals(isFloatingWaLeadSource(API_LEAD_SOURCE_WHATSAPP_BUTTON), true);
  assertEquals(isFloatingWaLeadSource("Website form"), false);
});

Deno.test("isLegacyApiLeadRow detects old labels", () => {
  assertEquals(isLegacyApiLeadRow({ title: "Lead Website", category: "Website API" }), true);
  assertEquals(isLegacyApiLeadRow({ created_by_name: "Website form" }), true);
  assertEquals(isLegacyApiLeadRow({ title: "Real title", category: "Sales" }), false);
});
