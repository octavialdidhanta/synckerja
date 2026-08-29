import { useContext } from "react";
import {
  CentralizedUserDataContext,
  DEFAULT_CENTRALIZED_USER_DATA,
  type CentralizedUserDataContextType,
} from "@/shared/auth/contexts/centralizedUserDataContext.shared";

export type { CentralizedUserDataContextType } from "@/shared/auth/contexts/centralizedUserDataContext.shared";

export const useCentralizedUserData = (): CentralizedUserDataContextType => {
  const context = useContext(CentralizedUserDataContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn(
        "useCentralizedUserData: called outside CentralizedUserDataProvider, using default (loading)",
      );
    }
    return DEFAULT_CENTRALIZED_USER_DATA;
  }
  return context;
};

export const useUserAuth = () => {
  const { user, loading, isAuthenticated } = useCentralizedUserData();
  return { user, loading, isAuthenticated };
};

export const useUserProfile = () => {
  const { userData, loading } = useCentralizedUserData();
  return { userData, loading };
};

export const useUserOrganization = () => {
  const { organization, loading, hasOrganization } = useCentralizedUserData();
  return { organization, loading, hasOrganization };
};
