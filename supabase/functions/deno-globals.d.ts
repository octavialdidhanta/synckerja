/** Minimal typings for Supabase Edge Functions (Deno). IDE uses this; runtime is Deno. */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}
