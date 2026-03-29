// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Unmark employees removal started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = await req.json();
    console.log("Request data:", requestBody);

    const { employeeIds, organizationId } = requestBody;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header missing");

    const authResult = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = authResult.data.user;
    if (authResult.error || !user) {
      console.error("Auth error:", authResult.error);
      throw new Error(`Authentication failed: ${authResult.error?.message ?? "No user"}`);
    }
    console.log("User authenticated:", user.email);

    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (roleError || !userRole) {
      console.error("Role check error:", roleError);
      throw new Error("User role not found or insufficient permissions");
    }

    const allowedRoles = ["owner", "admin", "hr"];
    if (!allowedRoles.includes(userRole.role)) {
      throw new Error(`Insufficient permissions. Required role: owner, admin, or hr. Current role: ${userRole.role}`);
    }

    console.log("User has required role:", userRole.role);

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        pending_removal: false,
        pending_removal_reason: null,
        pending_removal_date: null,
      })
      .in("id", employeeIds)
      .eq("organization_id", organizationId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to unmark employees from removal: ${updateError.message}`);
    }

    console.log("Successfully unmarked employees from removal:", employeeIds.length);

    return new Response(
      JSON.stringify({
        success: true,
        count: employeeIds.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("ERROR:", (error as Error).message);
    console.error("STACK:", (error as Error).stack);
    return new Response(
      JSON.stringify({
        error: "Failed to unmark employees from removal",
        message: (error as Error).message,
        details: (error as Error).stack,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
