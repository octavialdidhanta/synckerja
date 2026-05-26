/**
 * Canonical omnichannel assignee send gate.
 * Copy to each edge function folder before deploy (Supabase bundles per-function only).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ResolveEmployeeResult =
  | { ok: true; employeeId: string }
  | { ok: false; code: string; error: string; status: number };

export type AssigneeMismatchResult = {
  ok: false;
  code: "NOT_ASSIGNEE";
  error: string;
  status: 403;
};

export function assigneeMismatchResponse(): AssigneeMismatchResult {
  return {
    ok: false,
    code: "NOT_ASSIGNEE",
    error: "Hanya agen yang ditetapkan (assignee) pada percakapan ini yang dapat membalas.",
    status: 403,
  };
}

export function assertSenderIsActiveAssignee(
  conversationAssigneeId: string | null | undefined,
  senderEmployeeId: string,
): AssigneeMismatchResult | null {
  const convId = conversationAssigneeId == null ? "" : String(conversationAssigneeId).trim();
  if (!convId) return null;
  if (convId === senderEmployeeId) return null;
  return assigneeMismatchResponse();
}

export async function resolveEmployeeForOmnichannelSend(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<ResolveEmployeeResult> {
  const { data: rawEmployee, error: empErr } = await admin
    .from("employees")
    .select("id, employee_status_id, pending_removal")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empErr || !rawEmployee?.id) {
    return {
      ok: false,
      code: "NO_EMPLOYEE_FOR_USER",
      error:
        "Akun Anda tidak terhubung ke data karyawan aktif di organisasi ini. Hubungi HR atau admin organisasi.",
      status: 403,
    };
  }

  if (rawEmployee.pending_removal === true) {
    return {
      ok: false,
      code: "NO_EMPLOYEE_FOR_USER",
      error: "Akun karyawan Anda sedang dalam proses penghapusan dan tidak dapat mengirim pesan.",
      status: 403,
    };
  }

  if (rawEmployee.employee_status_id) {
    const { data: statusRow } = await admin
      .from("employee_statuses")
      .select("name")
      .eq("id", rawEmployee.employee_status_id as string)
      .maybeSingle();
    const statusName = String(statusRow?.name ?? "").trim().toLowerCase();
    if (statusName && statusName !== "active" && statusName !== "probation") {
      return {
        ok: false,
        code: "NO_EMPLOYEE_FOR_USER",
        error: "Status karyawan Anda tidak aktif untuk mengirim pesan omnichannel.",
        status: 403,
      };
    }
  }

  const employeeId = rawEmployee.id as string;
  const { data: rosterRow } = await admin
    .from("organization_omnichannel_staff")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (!rosterRow?.id) {
    return {
      ok: false,
      code: "NOT_ON_OMNICHANNEL_ROSTER",
      error:
        "Anda harus terdaftar di roster staff omnichannel organisasi ini. Hubungi admin omnichannel.",
      status: 403,
    };
  }

  return { ok: true, employeeId };
}

export function jsonGateError(
  result: { code: string; error: string; status: number },
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: result.error, code: result.code }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
