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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authResult = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authResult.error || !authResult.data.user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", authResult.data.user.id)
      .single();

    if (!profile?.active_organization_id) {
      return new Response(JSON.stringify({ error: "No active organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = profile.active_organization_id;

    console.log(`Processing employee removals for organization: ${organizationId}`);

    const { data: employeesToRemove, error: employeesError } = await supabase
      .from("employees")
      .select("id, full_name, email")
      .eq("organization_id", organizationId)
      .eq("pending_removal", true);

    if (employeesError) {
      console.error("Error fetching employees for removal:", employeesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch employees for removal", details: employeesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!employeesToRemove || employeesToRemove.length === 0) {
      console.log("No employees marked for removal");
      return new Response(
        JSON.stringify({ success: true, message: "No employees marked for removal", removed_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing removal of ${employeesToRemove.length} employee(s)...`);

    const employeeIds = employeesToRemove.map((emp) => emp.id);

    const { error: updateEmployeesError } = await supabase
      .from("employees")
      .update({
        status: "terminated",
        pending_removal: false,
        pending_removal_reason: null,
        pending_removal_date: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", employeeIds)
      .eq("organization_id", organizationId);

    if (updateEmployeesError) {
      console.error("Error updating employee status:", updateEmployeesError);
      return new Response(
        JSON.stringify({ error: "Failed to update employee status", details: updateEmployeesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Successfully removed ${employeesToRemove.length} employee(s) from organization`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully removed ${employeesToRemove.length} employee(s)`,
        removed_count: employeesToRemove.length,
        removed_employees: employeesToRemove.map((emp) => ({
          id: emp.id,
          name: emp.full_name,
          email: emp.email,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error processing employee removals:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process employee removals",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
