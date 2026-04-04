import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useKOLManagementData } from "./useKOLManagementData";

type UpdatePayload = Record<string, unknown>;

const isMissingRelationOrColumn = (err: unknown) => {
  const message = String((err as any)?.message || "");
  const code = String((err as any)?.code || "");
  return code === "42703" || message.includes("does not exist") || message.includes("relation");
};

export const useKOLProfileOperations = () => {
  const queryClient = useQueryClient();
  const { filteredProfiles } = useKOLManagementData({
    search: "",
    category: "all",
    platform: "all",
    status: "all",
    performance: "all",
  });

  const profiles = filteredProfiles;

  const updateKOLProfile = async (kolId: string, payload: UpdatePayload) => {
    const { error } = await supabase.from("kol_profiles").update(payload).eq("id", kolId);
    if (error) throw error;
    await invalidate();
  };

  const createSocialAccount = async (payload: UpdatePayload) => {
    try {
      const { error } = await supabase.from("kol_social_media_accounts").insert(payload);
      if (error) throw error;
      await invalidate();
    } catch (err) {
      if (!isMissingRelationOrColumn(err)) throw err;
    }
  };

  const updateSocialAccount = async (id: string, payload: UpdatePayload) => {
    try {
      const { error } = await supabase
        .from("kol_social_media_accounts")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      await invalidate();
    } catch (err) {
      if (!isMissingRelationOrColumn(err)) throw err;
    }
  };

  const deleteSocialAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from("kol_social_media_accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await invalidate();
    } catch (err) {
      if (!isMissingRelationOrColumn(err)) throw err;
    }
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["kol-management-data"] }),
      queryClient.invalidateQueries({ queryKey: ["kol-profiles-with-social"] }),
    ]);
  };

  return {
    profiles,
    updateKOLProfile,
    createSocialAccount,
    updateSocialAccount,
    deleteSocialAccount,
  };
};

