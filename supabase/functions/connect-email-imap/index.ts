/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { testDenoImapLogin } from "../_shared/denoImapClient.ts";
import { encryptEmailConnectionPassword } from "../_shared/emailConnectionCrypto.ts";
import { resolveImapProvider } from "../_shared/emailImapProviders.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

async function testImapLogin(
  email: string,
  password: string,
  imapHost: string,
  imapPort: number,
  provider: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return testDenoImapLogin({
    host: imapHost,
    port: imapPort,
    user: email,
    pass: password,
    provider,
  });
}

async function triggerImapSync(connectionId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/email-imap-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ connection_id: connectionId }),
    });
  } catch (e) {
    console.error("connect-email-imap: trigger sync failed", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("EMAIL_CONNECTION_ENCRYPTION_KEY")?.trim()) {
      return new Response(
        JSON.stringify({
          error: "EMAIL_CONNECTION_ENCRYPTION_KEY belum dikonfigurasi di Supabase secrets.",
          code: "ENCRYPTION_KEY_MISSING",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const organizationId = profile?.active_organization_id ?? null;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "No organization selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      action?: string;
      connection_id?: string;
      email_address?: string;
      password?: string;
      provider?: string;
      inbound_address?: string;
      imap_host?: string;
      imap_port?: number;
      smtp_host?: string;
      smtp_port?: number;
    };

    if (body.action === "sync" && body.connection_id?.trim()) {
      const connectionId = body.connection_id.trim();
      const { data: conn } = await supabaseAdmin
        .from("organization_email_connections")
        .select("id, organization_id, connection_method")
        .eq("id", connectionId)
        .maybeSingle();
      if (!conn || conn.organization_id !== organizationId || conn.connection_method !== "imap") {
        return new Response(JSON.stringify({ error: "Connection not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await triggerImapSync(connectionId);
      const { data: connRow } = await supabaseAdmin
        .from("organization_email_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      return new Response(JSON.stringify({ success: true, connection: connRow }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailAddress = body.email_address?.trim().toLowerCase() ?? "";
    let password = body.password ?? "";
    const inboundAddress = body.inbound_address?.trim().toLowerCase() ?? "";
    const providerName = body.provider?.trim() || "Hostinger (IMAP)";

    // Gmail App Passwords are often copied with spaces — strip them.
    if (providerName.toLowerCase().includes("gmail")) {
      password = password.replace(/\s+/g, "");
    } else {
      password = password.trim();
    }

    if (!emailAddress || !emailAddress.includes("@")) {
      return new Response(JSON.stringify({ error: "Email address is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password) {
      return new Response(JSON.stringify({ error: "Password is required for IMAP connect." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!inboundAddress || !inboundAddress.includes("@")) {
      return new Response(JSON.stringify({ error: "inbound_address is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerConfig = resolveImapProvider(body.provider, {
      imapHost: body.imap_host,
      imapPort: body.imap_port,
      smtpHost: body.smtp_host,
      smtpPort: body.smtp_port,
    });

    const imapTest = await testImapLogin(
      emailAddress,
      password,
      providerConfig.imapHost,
      providerConfig.imapPort,
      body.provider,
    );
    if (!imapTest.ok) {
      return new Response(JSON.stringify({ error: imapTest.message, code: "IMAP_AUTH_FAILED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passwordEnc = await encryptEmailConnectionPassword(password);

    const { data: existingByEmail } = await supabaseAdmin
      .from("organization_email_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email_address", emailAddress)
      .maybeSingle();

    let connectionId: string;
    const connectionPayload = {
      organization_id: organizationId,
      email_address: emailAddress,
      inbound_address: inboundAddress,
      provider: body.provider?.trim() || "Hostinger (IMAP)",
      status: "verified" as const,
      connection_method: "imap" as const,
      imap_host: providerConfig.imapHost,
      imap_port: providerConfig.imapPort,
      smtp_host: providerConfig.smtpHost,
      smtp_port: providerConfig.smtpPort,
      imap_sync_error: null,
      updated_at: new Date().toISOString(),
    };

    if (existingByEmail?.id) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("organization_email_connections")
        .update(connectionPayload)
        .eq("id", existingByEmail.id)
        .select("*")
        .single();
      if (updateErr || !updated) {
        console.error("connect-email-imap: update failed", updateErr);
        return new Response(JSON.stringify({ error: "Failed to update connection." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      connectionId = updated.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("organization_email_connections")
        .insert(connectionPayload)
        .select("*")
        .single();
      if (insertErr || !inserted) {
        console.error("connect-email-imap: insert failed", insertErr);
        return new Response(JSON.stringify({ error: insertErr?.message ?? "Failed to create connection." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      connectionId = inserted.id;
    }

    const { error: secretErr } = await supabaseAdmin
      .from("organization_email_connection_secrets")
      .upsert(
        { connection_id: connectionId, password_enc: passwordEnc, updated_at: new Date().toISOString() },
        { onConflict: "connection_id" },
      );
    if (secretErr) {
      console.error("connect-email-imap: secret upsert failed", secretErr);
      return new Response(JSON.stringify({ error: "Failed to store encrypted credentials." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await triggerImapSync(connectionId);

    const { data: connRow } = await supabaseAdmin
      .from("organization_email_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    return new Response(JSON.stringify({ success: true, connection: connRow }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("connect-email-imap error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
