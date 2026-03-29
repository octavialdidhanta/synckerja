/** JSR import is resolved at runtime by Deno; this silences IDE module resolution only. */
declare module "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Minimal Deno surface used by Edge Functions (IDE only; runtime is Deno on Supabase). */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
