import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export interface ReprimandData {
  id: string;
  employee_id: string;
  reprimand_type: "verbal_warning" | "written_warning" | "final_warning" | "suspension" | "termination";
  severity_level: "low" | "medium" | "high" | "critical";
  violation_category:
    | "attendance"
    | "performance"
    | "conduct"
    | "safety"
    | "policy_violation"
    | "insubordination"
    | "other";
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  violation_description: string;
  evidence_details?: string;
  witness_names?: string;
  previous_warnings_count: number;
  corrective_action_plan?: string;
  improvement_deadline?: string;
  follow_up_date?: string;
  acknowledgment_required: boolean;
  is_formal: boolean;
  impact_on_performance_review: boolean;
  notes?: string;
  document_path?: string;
  status: "active" | "resolved" | "appealed" | "cancelled";
  created_at: string;
  updated_at: string;
  employees?: {
    id: string;
    full_name: string;
    email: string;
    employee_id: string;
    department_name?: string;
    job_position_name?: string;
    profile_photo_url?: string;
    photo_url?: string;
  };
}

export interface CreateReprimandData {
  employee_id: string;
  reprimand_type: "verbal_warning" | "written_warning" | "final_warning" | "suspension" | "termination";
  severity_level: "low" | "medium" | "high" | "critical";
  violation_category:
    | "attendance"
    | "performance"
    | "conduct"
    | "safety"
    | "policy_violation"
    | "insubordination"
    | "other";
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  violation_description: string;
  evidence_details?: string;
  witness_names?: string;
  previous_warnings_count?: number;
  corrective_action_plan?: string;
  improvement_deadline?: string;
  follow_up_date?: string;
  acknowledgment_required?: boolean;
  is_formal?: boolean;
  impact_on_performance_review?: boolean;
  notes?: string;
  document_path?: string;
}

function stripEmptyOptionalStrings<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  const optionalKeys = [
    "improvement_deadline",
    "follow_up_date",
    "incident_time",
    "incident_location",
    "evidence_details",
    "witness_names",
    "corrective_action_plan",
    "notes",
    "document_path",
  ] as const;
  for (const k of optionalKeys) {
    if (out[k] === "") delete out[k];
  }
  return out as T;
}

export const useReprimands = () => {
  const { organizationId } = useCurrentOrg();

  const {
    data: reprimands = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["reprimands", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error: qError } = await supabase
        .from("reprimands")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (qError) throw qError;
      return data as ReprimandData[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    reprimands,
    isPending,
    isLoading: isPending,
    error,
    refetch,
  };
};

export const useCreateReprimand = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();

  return useMutation({
    mutationFn: async (reprimandData: CreateReprimandData) => {
      if (!organizationId) {
        throw new Error("No organization ID found");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error("Not authenticated");
      }

      const cleaned = stripEmptyOptionalStrings({ ...reprimandData });

      const { data, error: insError } = await supabase
        .from("reprimands")
        .insert([
          {
            ...cleaned,
            organization_id: organizationId,
            created_by: userId,
            issued_by: userId,
            status: "active",
            previous_warnings_count: cleaned.previous_warnings_count ?? 0,
            acknowledgment_required: cleaned.acknowledgment_required ?? true,
            is_formal: cleaned.is_formal ?? true,
            impact_on_performance_review: cleaned.impact_on_performance_review ?? true,
          },
        ])
        .select()
        .single();

      if (insError) throw insError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprimands", organizationId] });
      toast.success(t("reprimands.toast.createSuccess", "Reprimand created successfully"));
    },
    onError: () => {
      toast.error(t("reprimands.toast.createError", "Failed to create reprimand"));
    },
  });
};
