import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { mapShiftDetail } from "../shared/lib/mapShiftRow";
import type { ShiftDetail } from "../shared/lib/shiftTypes";

export function useShiftDetail(shiftId: string | null) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  return useQuery({
    queryKey: ["pos-shift-detail", organizationId, shiftId],
    enabled: Boolean(organizationId && shiftId) && !orgLoading,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ShiftDetail | null> => {
      if (!shiftId) return null;
      const { data, error } = await supabase.rpc("pos_shift_detail", {
        p_shift_id: shiftId,
      });
      if (error) throw error;
      return mapShiftDetail(data as Record<string, unknown> | null);
    },
  });
}
