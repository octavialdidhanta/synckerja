/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Public Google OAuth client IDs for native Supabase SSO (signInWithIdToken).
 * Set GOOGLE_SSO_WEB_CLIENT_ID (+ optional GOOGLE_SSO_IOS_CLIENT_ID) in project secrets.
 * Must match Supabase Auth → Google provider Client ID (not GOOGLE_CLIENT_ID / Drive OAuth).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const webClientId = (Deno.env.get("GOOGLE_SSO_WEB_CLIENT_ID") ?? "").trim();
    const iosClientId = (Deno.env.get("GOOGLE_SSO_IOS_CLIENT_ID") ?? "").trim();

    return new Response(
      JSON.stringify({
        webClientId: webClientId || null,
        iosClientId: iosClientId || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const err = error as Error;
    console.error("google-sso-public-config:", err);
    return new Response(JSON.stringify({ webClientId: null, iosClientId: null, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
