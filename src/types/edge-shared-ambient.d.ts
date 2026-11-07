/**
 * Some app modules import pure helpers from `supabase/functions/**` (shared with edge functions).
 * Those files target Deno: they read `Deno.env` inside server-only functions and import
 * `SupabaseClient` types from esm.sh. These declarations only let the app type-check them;
 * the Deno-only functions are never called in the browser.
 */
declare const Deno: {
  env: { get(key: string): string | undefined };
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
