import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { syncAfterOrganizationSwitch } from "@/shared/auth/identityQuerySync";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import {
  fetchUserOrganizations,
  userOrganizationsQueryKey,
  type UserOrganizationsData,
} from "@/shared/hooks/userOrganizationsQuery";

export type { OrganizationMembership, UserOrganizationsData } from "@/shared/hooks/userOrganizationsQuery";
export { fetchUserOrganizations, userOrganizationsQueryKey, buildUserOrganizationsData } from "@/shared/hooks/userOrganizationsQuery";

export function useUserOrganizations() {
  const queryClient = useQueryClient();
  const { centralProfileHydrated } = useCentralizedUserData();

  const query = useQuery({
    queryKey: userOrganizationsQueryKey,
    queryFn: () => fetchUserOrganizations(),
    enabled: centralProfileHydrated,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const setActiveMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: uo } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!uo) {
        throw new Error("not_member");
      }

      const { error } = await supabase
        .from("profiles")
        .update({ active_organization_id: organizationId })
        .eq("user_id", user.id);

      if (error) throw error;
      return organizationId;
    },
    onMutate: async (organizationId) => {
      await queryClient.cancelQueries({ queryKey: userOrganizationsQueryKey });
      const previous = queryClient.getQueryData<UserOrganizationsData>(userOrganizationsQueryKey);
      if (previous) {
        queryClient.setQueryData<UserOrganizationsData>(userOrganizationsQueryKey, {
          ...previous,
          activeOrganizationId: organizationId,
        });
      }
      return { previous };
    },
    onError: (_err, _organizationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userOrganizationsQueryKey, context.previous);
      }
    },
    onSuccess: async (organizationId) => {
      window.dispatchEvent(
        new CustomEvent("organization-switched", { detail: { organizationId } }),
      );
      await syncAfterOrganizationSwitch(queryClient, organizationId);
    },
  });

  const setActiveOrganization = async (organizationId: string) => {
    await setActiveMutation.mutateAsync(organizationId);
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    setActiveOrganization,
    isSwitching: setActiveMutation.isPending,
    switchError: setActiveMutation.error,
  };
}
