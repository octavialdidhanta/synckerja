import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadReplyContext, replyPreviewFromRow } from "./replyContext.ts";

Deno.test("text reply keeps the quoted text", () => {
  assertEquals(replyPreviewFromRow({ body: "lokasi dimana?", message_type: "text" }), {
    reply_to_body: "lokasi dimana?",
    reply_to_message_type: "text",
  });
});

Deno.test("media without caption shows the media type", () => {
  assertEquals(replyPreviewFromRow({ body: "", message_type: "image" }).reply_to_body, "[image]");
});

Deno.test("missing message falls back to [Pesan]", () => {
  assertEquals(replyPreviewFromRow(null), { reply_to_body: "[Pesan]", reply_to_message_type: null });
});

Deno.test("long text is trimmed to 500 chars", () => {
  assertEquals(replyPreviewFromRow({ body: "x".repeat(900), message_type: "text" }).reply_to_body.length, 500);
});

Deno.test("query looks up the quoted message in the same conversation", async () => {
  const calls: string[] = [];
  const client = {
    from: (t: string) => {
      calls.push(`from:${t}`);
      return {
        select: (c: string) => {
          calls.push(`select:${c}`);
          return {
            eq: (a: string, b: string) => {
              calls.push(`${a}=${b}`);
              return {
                eq: (c2: string, d: string) => {
                  calls.push(`${c2}=${d}`);
                  return { maybeSingle: () => Promise.resolve({ data: { body: "halo", message_type: "text" } }) };
                },
              };
            },
          };
        },
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  const ctx = await loadReplyContext(client as any, "facebook_messages", "conv1", "mid1");
  assertEquals(ctx.reply_to_body, "halo");
  assertEquals(calls, ["from:facebook_messages", "select:body, message_type", "conversation_id=conv1", "platform_message_id=mid1"]);
});

Deno.test("query error falls back to [Pesan]", async () => {
  const client = { from: () => { throw new Error("boom"); } };
  // deno-lint-ignore no-explicit-any
  const ctx = await loadReplyContext(client as any, "instagram_messages", "c", "m");
  assertEquals(ctx.reply_to_body, "[Pesan]");
});
