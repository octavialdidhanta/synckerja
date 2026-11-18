import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSupabaseJwtFromRequest } from "./googleDriveReviewAccess.ts";

Deno.test("reads the session JWT from the Authorization header", () => {
  const req = new Request("https://x/functions/v1/google-drive-file-media?file_id=a", {
    headers: { Authorization: "Bearer abc.def.ghi" },
  });
  assertEquals(parseSupabaseJwtFromRequest(req), "abc.def.ghi");
});

Deno.test("ignores the old supabase_token query parameter", () => {
  const url = "https://x/functions/v1/google-drive-file-media?file_id=a&supabase_token=abc.def.ghi";
  assertEquals(parseSupabaseJwtFromRequest(new Request(url), new URL(url)), null);
});

Deno.test("rejects an empty bearer", () => {
  const req = new Request("https://x/", { headers: { Authorization: "Bearer   " } });
  assertEquals(parseSupabaseJwtFromRequest(req), null);
});
