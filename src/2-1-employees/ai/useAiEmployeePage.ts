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
        sub_service_id: draft.subServiceIds[0] ?? null,
        sub_service_ids: draft.subServiceIds,
        content_plan_auto_approve: draft.contentPlanAutoApprove,
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
      p_start_local: row.startTimes[0] ?? row.startLocal,
      p_plan_count: 1,
      p_start_times: row.startTimes.length > 0 ? row.startTimes : [row.startLocal],
      p_is_active: row.isActive,
    });
    if (error) throw error;
    await reload();
  };

  const generateNow = async () => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { data, error } = await supabase.functions.invoke("ai-employee-run", {
      body: { employee_id: employeeId, mode: "sop1", manual: true },
    });
    if (error) {
      let code = "";
      const dataError = data && typeof data === "object" ? (data as { error?: unknown }).error : null;
      if (typeof dataError === "string") code = dataError;
      const context = (error as { context?: unknown }).context;
      if (!code && context instanceof Response) {
        const body = await context.clone().json().catch(() => null) as { error?: unknown } | null;
        if (typeof body?.error === "string") code = body.error;
      }
      throw new Error(code || "generate_failed");
    }
    const row = data && typeof data === "object"
      ? data as { ok?: boolean; error?: string; plan_count?: number; status?: string }
      : {};
    if (row.ok === false) throw new Error(row.error || "generate_failed");
    await reload();
    return { planCount: Number(row.plan_count ?? 0), status: String(row.status ?? "") };
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

  const saveReference = async (position: number, file: File) => {
    if (!isEmployeeUuid(employeeId) || !organizationId) throw new Error("not_found");
    const extension = file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/jpeg" || file.type === "image/jpg"
          ? "jpg"
          : "";
    if (!extension || file.size <= 0 || file.size > 5 * 1024 * 1024 || position < 1 || position > 5) {
      throw new Error("invalid_input");
    }
    const path = `${organizationId}/${employeeId}/${position}.${extension}`.toLowerCase();
    const { error: uploadError } = await supabase.storage
      .from("ai-employee-references")
      .upload(path, file, { upsert: true, contentType: file.type === "image/jpg" ? "image/jpeg" : file.type });
    if (uploadError) throw uploadError;
    const { error } = await supabase.rpc("ai_employee_brief_reference_set", {
      p_employee_id: employeeId,
      p_position: position,
      p_storage_path: path,
    });
    if (error) throw error;
    await reload();
  };

  const saveCatalogColor = async (input: {
    id: string | null;
    primary: string;
    secondary: string;
    accent: string;
  }) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_catalog_color_save", {
      p_employee_id: employeeId,
      p_color_id: input.id,
      p_brand_name: "",
      p_primary: input.primary,
      p_secondary: input.secondary,
      p_accent: input.accent,
    });
    if (error) throw error;
    await reload();
  };

  const selectCatalogColor = async (colorId: string | null) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_catalog_color_select", {
      p_employee_id: employeeId,
      p_color_id: colorId,
    });
    if (error) throw error;
    await reload();
  };

  const deleteCatalogColor = async (colorId: string) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_catalog_color_delete", {
      p_employee_id: employeeId,
      p_color_id: colorId,
    });
    if (error) throw error;
    await reload();
  };

  const saveCatalogLogo = async (input: { id: string | null; file: File | null }) => {
    if (!isEmployeeUuid(employeeId) || !organizationId) throw new Error("not_found");
    let path: string | null = null;
    if (input.file) {
      const name = input.file.name.toLowerCase();
      const extension = input.file.type === "image/png" || name.endsWith(".png")
        ? "png"
        : input.file.type === "image/webp" || name.endsWith(".webp")
          ? "webp"
          : input.file.type === "image/gif" || name.endsWith(".gif")
            ? "gif"
            : input.file.type === "image/jpeg" || input.file.type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")
              ? "jpg"
              : "";
      if (!extension || input.file.size <= 0 || input.file.size > 5 * 1024 * 1024) throw new Error("invalid_input");
      path = `${organizationId}/${crypto.randomUUID()}.${extension}`.toLowerCase();
      const contentType = extension === "jpg" ? "image/jpeg" : input.file.type || `image/${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("digital-asset-company-logos")
        .upload(path, input.file, { upsert: false, contentType });
      if (uploadError) throw uploadError;
    }
    const { error } = await supabase.rpc("ai_employee_catalog_logo_save", {
      p_employee_id: employeeId,
      p_logo_id: input.id,
      p_brand_name: "",
      p_storage_path: path,
    });
    if (error) {
      if (path) await supabase.storage.from("digital-asset-company-logos").remove([path]);
      throw error;
    }
    await reload();
  };

  const selectCatalogLogo = async (logoId: string | null) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_catalog_logo_select", {
      p_employee_id: employeeId,
      p_logo_id: logoId,
    });
    if (error) throw error;
    await reload();
  };

  const deleteCatalogLogo = async (logoId: string) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_catalog_logo_delete", {
      p_employee_id: employeeId,
      p_logo_id: logoId,
    });
    if (error) throw error;
    await reload();
  };

  const clearReference = async (position: number) => {
    if (!isEmployeeUuid(employeeId)) throw new Error("not_found");
    const { error } = await supabase.rpc("ai_employee_brief_reference_clear", {
      p_employee_id: employeeId,
      p_position: position,
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
    generateNow,
    saveRoutine,
    saveReference,
    clearReference,
    saveCatalogColor,
    selectCatalogColor,
    deleteCatalogColor,
    saveCatalogLogo,
    selectCatalogLogo,
    deleteCatalogLogo,
    saveReportCopies,
  };
}
