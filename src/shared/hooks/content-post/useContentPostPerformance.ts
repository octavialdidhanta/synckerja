import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export const useContentPostPerformance = (postIds: string[]) => {
  const metricsQuery = useQuery({
    queryKey: ["kol-content-performance", ...postIds.sort()],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kol_performance_metrics")
        .select("*")
        .in("content_post_id", postIds);
      if (error) throw error;
      return data || [];
    },
  });

  const conversionsQuery = useQuery({
    queryKey: ["kol-content-conversions", ...postIds.sort()],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("kol_conversions").select("*").in("content_post_id", postIds);
      if (error) throw error;
      return data || [];
    },
  });

  const metricsByPostId = useMemo(() => {
    return (metricsQuery.data || []).reduce<Record<string, any>>((acc, row: any) => {
      acc[row.content_post_id] = row;
      return acc;
    }, {});
  }, [metricsQuery.data]);

  const conversionByPostId = useMemo(() => {
    return (conversionsQuery.data || []).reduce<Record<string, { count: number; value: number }>>(
      (acc, row: any) => {
        const key = row.content_post_id;
        if (!acc[key]) acc[key] = { count: 0, value: 0 };
        acc[key].count += 1;
        acc[key].value += Number(row.conversion_value || 0);
        return acc;
      },
      {},
    );
  }, [conversionsQuery.data]);

  /** Dua query paralel — tunggu keduanya keluar dari `pending` (success/error) supaya tidak ada kedip saat reload. */
  const awaitingInitialFetch =
    postIds.length > 0 &&
    (metricsQuery.status === "pending" || conversionsQuery.status === "pending");

  return {
    metricsByPostId,
    conversionByPostId,
    isLoading: metricsQuery.isLoading || conversionsQuery.isLoading,
    isPending: metricsQuery.isPending || conversionsQuery.isPending,
    awaitingInitialFetch,
  };
};
