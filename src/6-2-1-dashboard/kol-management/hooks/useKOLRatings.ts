import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

type KOLRating = {
  id: string;
  kol_profile_id: string;
  organization_id: string;
  overall_rating: number;
  created_at: string;
};

export const useKOLRatings = () => {
  const { organizationId } = useCurrentOrg();

  const { data: ratings = [], isLoading, isPending } = useQuery<KOLRating[]>({
    queryKey: ["kol-ratings", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("kol_ratings")
        .select("id, kol_profile_id, organization_id, overall_rating, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) {
        const msg = error.message || "";
        // Kalau di environment tertentu tabel belum siap, jangan lempar error ke UI
        if (
          error.code === "PGRST204" ||
          msg.includes("does not exist") ||
          msg.includes("schema cache")
        ) {
          return [];
        }

        throw error;
      }

      const safeData = (data || []) as KOLRating[];
      // eslint-disable-next-line no-console
      console.log("[useKOLRatings] fetched ratings", {
        organizationId,
        count: safeData.length,
      });
      return safeData;
    },
  });

  const getKOLRatings = useCallback(
    (kolId: string) => ratings.filter((r) => r.kol_profile_id === kolId) || [],
    [ratings],
  );

  const getAverageRating = useCallback(
    (kolId: string) => {
      const kolRatings = getKOLRatings(kolId);
      if (kolRatings.length === 0) return 0;
      const sum = kolRatings.reduce((acc, r) => acc + Number(r.overall_rating || 0), 0);
      return sum / kolRatings.length;
    },
    [getKOLRatings],
  );

  return {
    ratings,
    isLoading,
    isPending,
    getKOLRatings,
    getAverageRating,
  };
};

