import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { invalidateCatalogStockCaches } from "./invalidateCatalogStockCaches";

const DEBOUNCE_MS = 150;

/**
 * Live refresh when catalog_ingredient_outlets.in_stock changes
 * (kitchen commit, void reverse, produce, checkout, etc.).
 */
export function useCatalogIngredientStockRealtime(
  organizationId: string | null | undefined,
  channelSuffix = "default",
) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void invalidateCatalogStockCaches(queryClient, organizationId);
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`catalog-ingredient-outlets-${channelSuffix}-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catalog_ingredient_outlets",
          filter: `organization_id=eq.${organizationId}`,
        },
        schedule,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, channelSuffix, queryClient]);
}
