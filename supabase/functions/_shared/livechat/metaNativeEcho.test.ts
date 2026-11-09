import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { echoMessageBody, planNativeEcho } from "./metaNativeEcho.ts";

const OWN_APP = "1234567890";

Deno.test("planNativeEcho — reply typed in the Instagram / Facebook app is stored", () => {
  const plan = planNativeEcho(
    { is_echo: true, mid: "m_abc", text: "Saat ini hanya bisa dine in saja pak" },
    "3677588552406216",
    OWN_APP,
  );
  assertEquals(plan, { store: true, mid: "m_abc", body: "Saat ini hanya bisa dine in saja pak", messageType: "text" });
});

Deno.test("planNativeEcho — echo of a message sent by Synckerja (own app_id) is skipped", () => {
  const plan = planNativeEcho({ is_echo: true, mid: "m_abc", app_id: 1234567890, text: "hi" }, "psid-1", OWN_APP);
  assertEquals(plan, { store: false, reason: "own_app" });
});

Deno.test("planNativeEcho — another app id (Page inbox, Business Suite) is stored", () => {
  const plan = planNativeEcho({ is_echo: true, mid: "m_x", app_id: "263902037430900", text: "ok" }, "psid-1", OWN_APP);
  assertEquals(plan.store, true);
});

Deno.test("planNativeEcho — not an echo, deleted, missing mid or customer are skipped", () => {
  assertEquals(planNativeEcho({ mid: "m", text: "x" }, "c", OWN_APP), { store: false, reason: "not_echo" });
  assertEquals(planNativeEcho(undefined, "c", OWN_APP), { store: false, reason: "not_echo" });
  assertEquals(planNativeEcho({ is_echo: true, is_deleted: true, mid: "m" }, "c", OWN_APP), { store: false, reason: "deleted" });
  assertEquals(planNativeEcho({ is_echo: true, text: "x" }, "c", OWN_APP), { store: false, reason: "no_mid" });
  assertEquals(planNativeEcho({ is_echo: true, mid: "m", text: "x" }, null, OWN_APP), { store: false, reason: "no_customer" });
  assertEquals(planNativeEcho({ is_echo: true, mid: "m", text: "x" }, "  ", OWN_APP), { store: false, reason: "no_customer" });
});

Deno.test("planNativeEcho — without a configured app id nothing is treated as own", () => {
  assertEquals(planNativeEcho({ is_echo: true, mid: "m", app_id: "1", text: "x" }, "c", null).store, true);
});

Deno.test("echoMessageBody — text, attachment and fallback labels match inbound", () => {
  assertEquals(echoMessageBody({ text: "  halo  " }), { body: "halo", messageType: "text" });
  assertEquals(echoMessageBody({ text: { text: "nested" } }), { body: "nested", messageType: "text" });
  assertEquals(echoMessageBody({ attachments: [{ type: "image" }] }), { body: "[image]", messageType: "image" });
  assertEquals(echoMessageBody({ attachments: [{}] }), { body: "[file]", messageType: "file" });
  assertEquals(echoMessageBody({}), { body: "[message]", messageType: "text" });
});
