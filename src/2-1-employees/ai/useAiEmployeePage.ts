import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { classifyAiEmployeeError, parseAiEmployeePage, type AiEmployeeFailure } from "./parse";
import type { AiEmployeePageData, BriefDraft, RoutineRow, ScheduleRow } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEmployeeUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function pageKey(organizationId: string | null, employeeId: string | undefined) {
  return ["ai-employee-page", organizationId, employeeId] as const;
}

async function readPage(employeeId: string): Promise<AiEmployeePageData> {
  const { data, error } = await supabase.rpc("ai_employee_page_read", {
    p_employee_id: employeeId,
  });
  if (error) throw error;
  return parseAiEmployeePage(data);
}

export function useAiEmployeePage(employeeId: string | undefined) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const enabled = Boolean(organizationId && isEmployeeUuid(employeeId));
  const query = useQuery({
    queryKey: pageKey(organizationId, employeeId),
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => readPage(employeeId as string),
  });

  const page = query.data && organizationId && query.data.organizationId === organizationId
    ? query.data
    : null;
  const otherOrg = Boolean(query.data && organizationId && query.data.organizationId !== organizationId);
  const missingPage = otherOrg
    || (!isEmployeeUuid(employeeId) && !orgBootstrapPending)
    || (!organizationId && !orgBootstrapPending);
  const failure: AiEmployeeFailure | null = missingPage
    ? "not_found"
    : query.isError
      ? classifyAiEmployeeError(query.error)
      : null;

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: pageKey(organizationId, employeeId) });
  };

  const saveBrief = async (draft: BriefDraft) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_page_brief_save", {
      p_employee_id: employeeId,
      p_brief: {
        service_ids: draft.serviceIds,
        audience: draft.audience,
        persona_ids: draft.personaIds,
        voice: draft.voice,
        required_notes: draft.requiredNotes,
        forbidden_notes: draft.forbiddenNotes,
        pillar_ids: draft.pillarIds,
        product_knowledge_ids: draft.productIds,
        angle_ids: draft.angleIds,
        repeat_voices: draft.repeatVoices,
        split_rule: draft.splitRule,
      },
    });
    if (error) throw error;
    await reload();
  };

  const saveSchedule = async (row: ScheduleRow) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_page_schedule_save", {
      p_employee_id: employeeId,
      p_sop_code: row.sopCode,
      p_cadence: row.cadence,
      p_weekday: row.cadence === "weekly" ? row.weekday : null,
      p_weekdays: row.cadence === "days" ? row.weekdays : null,
      p_start_local: row.startLocal,
      p_plan_count: row.planCount,
      p_is_active: row.isActive,
    });
    if (error) throw error;
    await reload();
  };

  const saveRoutine = async (row: RoutineRow) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_page_routine_save", {
      p_employee_id: employeeId,
      p_action_code: row.actionCode,
      p_cadence: row.cadence,
      p_weekday: row.cadence === "weekly" ? row.weekday : null,
      p_time_local: row.timeLocal,
      p_is_active: row.isActive,
      p_weekdays: row.cadence === "days" ? row.weekdays : null,
    });
    if (error) throw error;
    await reload();
  };

  const saveReportCopies = async (email1: string, email2: string) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_page_report_copies_save", {
      p_employee_id: employeeId,
      p_email_1: email1.trim() || null,
      p_email_2: email2.trim() || null,
    });
    if (error) throw error;
    await reload();
  };

  return {
    organizationId,
    page,
    failure,
    showFullPageSkeleton: orgBootstrapPending || (enabled && query.isLoading),
    reload,
    saveBrief,
    saveSchedule,
    saveRoutine,
    saveReportCopies,
  };
}
