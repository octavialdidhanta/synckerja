import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchWabaDatasetId, pickCtwaAccount } from "./ctwaCapiDestination.ts";
import { buildCtwaCapiEvent } from "./metaAdsCapiHelpers.ts";

const row = (waba: string, phone: string, token = "tok", dataset: string | null = null) => ({
  whatsapp_business_account_id: waba,
  phone_number_id: phone,
  meta_access_token: token,
  capi_dataset_id: dataset,
});

Deno.test("pickCtwaAccount: matches the phone that received the ad click", () => {
  const rows = [row("111", "p1"), row("222", "p2")];
  assertEquals(pickCtwaAccount(rows, "p2")?.whatsapp_business_account_id, "222");
});

Deno.test("pickCtwaAccount: falls back only when the org has a single WABA", () => {
  assertEquals(pickCtwaAccount([row("111", "p1"), row("111", "p3")], "unknown")?.whatsapp_business_account_id, "111");
  assertEquals(pickCtwaAccount([row("111", "p1"), row("222", "p2")], "unknown"), null);
  assertEquals(pickCtwaAccount([row("111", "p1", "")], "p1"), null);
  assertEquals(pickCtwaAccount([], null), null);
});

Deno.test("fetchWabaDatasetId: posts to /{waba}/dataset and returns the id", async () => {
  let calledUrl = "";
  let calledMethod = "";
  const fakeFetch = ((url: string, init?: RequestInit) => {
    calledUrl = url;
    calledMethod = init?.method ?? "";
    return Promise.resolve(new Response(JSON.stringify({ id: "999" }), { status: 200 }));
  }) as typeof fetch;
  const res = await fetchWabaDatasetId("4457641537783842", "tok en", "v22.0", fakeFetch);
  assertEquals(res, { ok: true, datasetId: "999" });
  assertEquals(calledMethod, "POST");
  assertEquals(calledUrl, "https://graph.facebook.com/v22.0/4457641537783842/dataset?access_token=tok%20en");

  const failFetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ error: { message: "no" } }), { status: 400 }))) as typeof fetch;
  const failed = await fetchWabaDatasetId("1", "t", "v22.0", failFetch);
  assertEquals(failed.ok, false);
});

Deno.test("buildCtwaCapiEvent: business messaging event with WABA id and ctwa_clid", () => {
  const event = buildCtwaCapiEvent({
    ctwa_clid: " clid ",
    whatsapp_business_account_id: " 4457641537783842 ",
    event_name: "Purchase",
    event_time: 1,
    event_id: "lead_x:ctwa",
    hashedUserData: { ph: ["h"] },
    conversionValue: 50000,
    currency: "IDR",
    leadId: "x",
  });
  assertEquals(event.action_source, "business_messaging");
  assertEquals(event.messaging_channel, "whatsapp");
  assertEquals(event.user_data, { whatsapp_business_account_id: "4457641537783842", ctwa_clid: "clid", ph: ["h"] });
});
