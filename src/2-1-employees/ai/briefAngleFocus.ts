import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { anglesForCatalogs, anglesWithLockedIdeas, syncPillarIdsForAngles } from "./angleCatalog";
import { parseAiEmployeePage } from "./parse";
import type { AngleOption, BriefDraft } from "./types";

/** Same limit as AiEmployeePage / ai_employee_briefs CHECK. */
export const MAX_BRIEF_ANGLES = 6;

export type ToggleBriefAngleAction = "added" | "removed" | "blocked_max";

export function toggleBriefAngleId(
  currentIds: readonly string[],
  angleId: string,
  max = MAX_BRIEF_ANGLES,
): { next: string[]; action: ToggleBriefAngleAction } {
  if (currentIds.includes(angleId)) {
    return { next: currentIds.filter((id) => id !== angleId), action: "removed" };
  }
  if (currentIds.length >= max) {
    return { next: [...currentIds], action: "blocked_max" };
  }
  return { next: [...currentIds, angleId], action: "added" };
}

export function isAngleEligibleForBrief(
  options: readonly AngleOption[],
  catalogIds: readonly string[],
  angleId: string,
): boolean {
  return anglesWithLockedIdeas(anglesForCatalogs([...options], [...catalogIds])).some(
    (option) => option.id === angleId,
  );
}

export function aiEmployeePageQueryKey(organizationId: string | null, employeeId: string | undefined) {
  return ["ai-employee-page", organizationId, employeeId] as const;
}

/** Single brief RPC payload for modal save and Thinking Lab angle toggle. */
export function briefPayloadFromDraft(draft: BriefDraft) {
  const pillarIds = draft.angleIds.length === 0 ? [] : draft.pillarIds;
  return {
    service_ids: draft.serviceIds,
    audience: draft.audience,
    persona_ids: draft.personaIds,
    voice: draft.voice,
    required_notes: draft.requiredNotes,
    forbidden_notes: draft.forbiddenNotes,
    pillar_ids: pillarIds,
    product_knowledge_ids: draft.productIds,
    angle_ids: draft.angleIds,
    repeat_voices: draft.repeatVoices,
    // Dead field: always clear on save (no UI/script/Canva consumer).
    split_rule: "",
    sub_service_id: draft.subServiceIds[0] ?? null,
    sub_service_ids: draft.subServiceIds,
    content_plan_auto_approve: draft.contentPlanAutoApprove,
    use_system_hooks: draft.useSystemHooks !== false,
    execution_check_enabled: draft.executionCheckEnabled !== false,
  };
}

export type ToggleAiEmployeeBriefAngleResult =
  | { ok: true; action: "added" | "removed"; angleIds: string[]; page: ReturnType<typeof parseAiEmployeePage> }
  | { ok: false; reason: "not_eligible" | "blocked_max"; page: ReturnType<typeof parseAiEmployeePage> };

/**
 * One fresh read → eligibility/toggle → full brief save → invalidate.
 * Avoids computing next ids from a stale cache then overwriting a newer server brief.
 */
export async function toggleAiEmployeeBriefAngle(args: {
  employeeId: string;
  organizationId: string | null;
  angleId: string;
  queryClient: QueryClient;
}): Promise<ToggleAiEmployeeBriefAngleResult> {
  const { data, error: readError } = await supabase.rpc("ai_employee_page_read", {
    p_employee_id: args.employeeId,
  });
  if (readError) throw readError;
  const page = parseAiEmployeePage(data);
  args.queryClient.setQueryData(
    aiEmployeePageQueryKey(args.organizationId, args.employeeId),
    page,
  );

  const currentIds = page.brief.angleIds;
  const already = currentIds.includes(args.angleId);
  if (!already) {
    const eligible = isAngleEligibleForBrief(
      page.options.angles,
      page.brief.serviceIds,
      args.angleId,
    );
    if (!eligible) return { ok: false, reason: "not_eligible", page };
  }

  const { next, action } = toggleBriefAngleId(currentIds, args.angleId, MAX_BRIEF_ANGLES);
  if (action === "blocked_max") return { ok: false, reason: "blocked_max", page };

  const draft: BriefDraft = {
    ...page.brief,
    angleIds: next,
    pillarIds: syncPillarIdsForAngles(page.options.angles, next),
  };
  const { error: saveError } = await supabase.rpc("ai_employee_page_brief_save", {
    p_employee_id: args.employeeId,
    p_brief: briefPayloadFromDraft(draft),
  });
  if (saveError) throw saveError;

  const savedPage = { ...page, brief: draft };
  args.queryClient.setQueryData(
    aiEmployeePageQueryKey(args.organizationId, args.employeeId),
    savedPage,
  );
  await args.queryClient.invalidateQueries({
    queryKey: aiEmployeePageQueryKey(args.organizationId, args.employeeId),
  });
  return { ok: true, action, angleIds: next, page: savedPage };
}
