import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";

interface ProRateRequest {
  new_member_count: number;
  target_plan_id?: string;
}

export function useProRateCalculation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (request: ProRateRequest) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error(t("auth.login.sessionExpired"));
      }
      const { data, error } = await supabase.functions.invoke("calculate-prorate", {
        body: request,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }
      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message || t("subscription.plans.hooks.prorateFailed"));
    },
  });
}
