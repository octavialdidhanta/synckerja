/**
 * Proxy invoice-trigger to Synckerja Omnichannel API (server token only).
 *
 * Secrets (Supabase CMS project):
 *   SYNCKERJA_OMNI_API_TOKEN=sk_omni_...
 *   SYNCKERJA_OMNI_API_BASE=https://<project>.supabase.co/functions/v1/omnichannel-public-api
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name)?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const base = mustGetEnv("SYNCKERJA_OMNI_API_BASE").replace(/\/$/, "");
    const token = mustGetEnv("SYNCKERJA_OMNI_API_TOKEN");
    const body = await req.text();

    const upstream = await fetch(`${base}/api/v1/orders/invoice-trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
