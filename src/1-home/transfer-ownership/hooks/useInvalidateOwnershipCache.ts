import { useQueryClient } from "@tanstack/react-query";

const USER_ORGS_KEY = ["user-organizations"] as const;
const AUTH_HEADER_KEY = ["auth-user-header"] as const;

export function useInvalidateOwnershipCache() {
  const queryClient = useQueryClient();

  const invalidateOwnershipData = async () => {
    await queryClient.invalidateQueries({ queryKey: USER_ORGS_KEY });
    await queryClient.invalidateQueries({ queryKey: AUTH_HEADER_KEY });
  };

  const forceRefreshAllData = async () => {
    queryClient.clear();
    await queryClient.refetchQueries({ type: "active" });
  };

  return { invalidateOwnershipData, forceRefreshAllData };
}
