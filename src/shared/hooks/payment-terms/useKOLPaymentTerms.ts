import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";

type ThresholdCommon = {
  organization_id: string;
  payment_terms_id: string;
  kol_content_post_id: string | null;
  kol_profile_id: string | null;
  campaign_id: string | null;
  is_active: boolean;
  description: string | null;
};

const normalizeMetricType = (metric: string): string => {
  const m = String(metric || "").toLowerCase();
  return m === "conversions" ? "conversion" : m;
};

function collectThresholdRows(thresholds: unknown, common: ThresholdCommon): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  const pushRow = (metric: string, value: unknown, bonus?: unknown) => {
    const metricType = normalizeMetricType(metric);
    if (value === undefined || value === null || Number.isNaN(Number(value))) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    rows.push({
      ...common,
      metric_type: metricType,
      target_value: n,
      bonus_percentage: bonus !== undefined && bonus !== null && String(bonus) !== "" ? Number(bonus) : 0,
    });
  };

  if (Array.isArray(thresholds)) {
    thresholds.forEach((t: { metric?: string; threshold?: unknown; bonus_percentage?: unknown }) => {
      pushRow(String(t.metric || "").toLowerCase(), t.threshold, t.bonus_percentage);
    });
    return rows;
  }

  if (!thresholds || typeof thresholds !== "object") return rows;

  const o = thresholds as Record<string, unknown>;
  let nestedFound = false;

  for (const [key, val] of Object.entries(o)) {
    if (val && typeof val === "object" && !Array.isArray(val) && "threshold" in (val as object)) {
      nestedFound = true;
      const item = val as { threshold?: unknown; bonus_percentage?: unknown };
      pushRow(key, item.threshold, item.bonus_percentage);
    }
  }

  if (nestedFound) return rows;

  pushRow("reach", o.target_reach, o.reach_bonus_percentage);
  pushRow("engagement", o.target_engagement, o.engagement_bonus_percentage);
  pushRow(
    "conversion",
    (o as { target_conversions?: unknown }).target_conversions ??
      (o as { target_conversion?: unknown }).target_conversion,
    o.conversion_bonus_percentage,
  );
  pushRow("views", o.target_views, o.views_bonus_percentage);
  pushRow("clicks", o.target_clicks, o.clicks_bonus_percentage);
  pushRow("saves", o.target_saves, o.saves_bonus_percentage);
  pushRow("shares", o.target_shares, o.shares_bonus_percentage);
  pushRow("comments", o.target_comments, o.comments_bonus_percentage);
  pushRow("likes", o.target_likes, o.likes_bonus_percentage);

  return rows;
}

/** PostgREST / schema cache: table or relation missing on remote DB */
function isMissingSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message || "");
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache")
  );
}

/**
 * After one failed probe, skip further REST calls to this table for the page session
 * (avoids repeated 404s in the network tab until migrations are applied).
 * Hard-refresh after `supabase db push` so sync is tried again.
 */
let kolPerformanceThresholdsUnavailableSession = false;
let loggedKolPerformanceThresholdsUnavailable = false;

function markThresholdTableUnavailable() {
  kolPerformanceThresholdsUnavailableSession = true;
  if (loggedKolPerformanceThresholdsUnavailable) return;
  loggedKolPerformanceThresholdsUnavailable = true;
  console.warn(
    "[useKOLPaymentTerms] Tabel kol_performance_thresholds belum ada di project Supabase ini. " +
      "Payment term tetap tersimpan (kolom performance_thresholds di kol_payment_terms). " +
      "Jalankan migrasi yang membuat kol_performance_thresholds lalu refresh halaman.",
  );
}

async function syncPerformanceThresholdRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0 || kolPerformanceThresholdsUnavailableSession) return;
  const { error } = await supabase.from("kol_performance_thresholds").insert(rows);
  if (error) {
    if (isMissingSchemaError(error)) {
      markThresholdTableUnavailable();
      return;
    }
    console.error("Failed to sync performance thresholds:", error);
  }
}

export const useKOLPaymentTerms = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: paymentTerms, isLoading, isPending } = useQuery({
    queryKey: ["kol-payment-terms", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const withRelations = await supabase
        .from("kol_payment_terms")
        .select(
          `
          *,
          kol_profiles(id, name, email),
          kol_content_posts(id, title, post_url)
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (!withRelations.error) {
        return withRelations.data || [];
      }

      console.warn(
        "[useKOLPaymentTerms] list with relations failed; falling back to kol_payment_terms only:",
        withRelations.error,
      );

      const plain = await supabase
        .from("kol_payment_terms")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (plain.error) throw plain.error;
      return plain.data || [];
    },
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  });

  const createPaymentTerm = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!organizationId) throw new Error("Missing organization");

      const resolvedType =
        data.type === "template" || data.type === "agreement" ? data.type : "template";

      const paymentTermData = {
        ...data,
        organization_id: organizationId,
        type: resolvedType,
        campaign_id: data.campaign_id ?? null,
        kol_profile_id: data.kol_profile_id ?? null,
        milestones: data.milestones ?? [],
        effective_start_date: data.effective_start_date ?? null,
        effective_end_date: data.effective_end_date ?? null,
        template_name: data.template_name ?? null,
      };

      const { data: inserted, error } = await supabase
        .from("kol_payment_terms")
        .insert(paymentTermData)
        .select()
        .single();

      if (error) throw error;

      try {
        const common: ThresholdCommon = {
          organization_id: organizationId!,
          payment_terms_id: inserted.id,
          kol_content_post_id: inserted.kol_content_post_id ?? null,
          kol_profile_id: inserted.kol_profile_id ?? null,
          campaign_id: inserted.campaign_id ?? null,
          is_active: true,
          description: null,
        };
        const rows = collectThresholdRows(data.performance_thresholds, common);
        await syncPerformanceThresholdRows(rows);
      } catch (e) {
        console.error("Error while syncing thresholds:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] });
      toast({
        title: "Success",
        description: "Payment term created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create payment term",
        variant: "destructive",
      });
    },
  });

  const updatePaymentTerm = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      if (!organizationId) throw new Error("Missing organization");

      const { error } = await supabase.from("kol_payment_terms").update(data).eq("id", id);

      if (error) throw error;

      if (data && Object.prototype.hasOwnProperty.call(data, "performance_thresholds")) {
        try {
          if (!kolPerformanceThresholdsUnavailableSession) {
            const { error: delErr } = await supabase
              .from("kol_performance_thresholds")
              .delete()
              .eq("payment_terms_id", id)
              .eq("organization_id", organizationId!);

            if (delErr) {
              if (isMissingSchemaError(delErr)) {
                markThresholdTableUnavailable();
              } else {
                console.error("Failed to clear performance thresholds on update:", delErr);
              }
            }
          }

          const common: ThresholdCommon = {
            organization_id: organizationId!,
            payment_terms_id: id,
            kol_content_post_id: (data.kol_content_post_id as string | null) ?? null,
            kol_profile_id: (data.kol_profile_id as string | null) ?? null,
            campaign_id: (data.campaign_id as string | null) ?? null,
            is_active: true,
            description: null,
          };
          const rows = collectThresholdRows(data.performance_thresholds, common);
          await syncPerformanceThresholdRows(rows);
        } catch (e) {
          console.error("Error while syncing thresholds on update:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] });
      queryClient.invalidateQueries({ queryKey: ["payment-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["content-post-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["kol-content-posts"] });
      toast({
        title: "Success",
        description: "Payment term updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment term",
        variant: "destructive",
      });
    },
  });

  const deletePaymentTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kol_payment_terms").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] });
      toast({
        title: "Success",
        description: "Payment term deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete payment term",
        variant: "destructive",
      });
    },
  });

  const updatePaymentStatus = useMutation({
    mutationFn: async ({ id, paymentData }: { id: string; paymentData: Record<string, unknown> }) => {
      const updateData: Record<string, unknown> = {};

      if (paymentData.down_payment_amount !== undefined) {
        updateData.down_payment_amount = paymentData.down_payment_amount;
      }
      if (paymentData.down_payment_date !== undefined) {
        updateData.down_payment_date = paymentData.down_payment_date;
      }
      if (paymentData.remaining_amount !== undefined) {
        updateData.remaining_amount = paymentData.remaining_amount;
      }
      if (paymentData.final_payment_date !== undefined) {
        updateData.final_payment_date = paymentData.final_payment_date;
      }
      if (paymentData.deduction_amount !== undefined) {
        updateData.deduction_amount = paymentData.deduction_amount;
      }
      if (paymentData.deduction_reason !== undefined) {
        updateData.deduction_reason = paymentData.deduction_reason;
      }
      if (paymentData.status !== undefined) {
        updateData.status = paymentData.status;
      }

      const { error } = await supabase.from("kol_payment_terms").update(updateData).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] });
      queryClient.invalidateQueries({ queryKey: ["payment-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["content-post-milestones"] });
      toast({
        title: "Success",
        description: "Payment status updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: String((error as Error)?.message || "Failed to update payment status"),
        variant: "destructive",
      });
    },
  });

  return {
    paymentTerms: paymentTerms || [],
    isLoading,
    isPending,
    createPaymentTerm: (data: Record<string, unknown>) => createPaymentTerm.mutateAsync(data),
    updatePaymentTerm: (id: string, data: Record<string, unknown>) => updatePaymentTerm.mutateAsync({ id, data }),
    updatePaymentStatus: (id: string, paymentData: Record<string, unknown>) =>
      updatePaymentStatus.mutateAsync({ id, paymentData }),
    deletePaymentTerm: (id: string) => deletePaymentTerm.mutateAsync(id),
    refetch: () => queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] }),
  };
};
