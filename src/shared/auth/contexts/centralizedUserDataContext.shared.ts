import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { OrganizationAccessState } from "@/shared/auth/organizationAccess/organizationAccessTypes";

export interface CentralizedUserData {
  user_id: string;
  full_name: string;
  email: string;
  active_organization_id?: string;
  department_id?: string;
  email_verified?: boolean;
  preferred_locale?: string | null;
}

export interface CentralizedOrganization {
  id: string;
  company_name: string;
  industry?: string;
  address?: string;
  website?: string;
  user_id?: string;
  subscription_self_service_enabled?: boolean;
}

export interface CentralizedEmployee {
  id: string;
  employee_id: string;
  full_name: string;
  profile_photo_url?: string | null;
  department_id?: string;
  job_level_id?: string | null;
  job_levels?: { id: string; name: string } | null;
  departments?: { name: string } | null;
  department?: { name: string } | null;
}

export type CentralizedUserRole =
  | "owner"
  | "admin"
  | "employee"
  | "hr"
  | "manager"
  | "member"
  | null;

export interface CentralizedUserDataContextType {
  user: User | null;
  userData: CentralizedUserData | null;
  organization: CentralizedOrganization | null;
  userRole: CentralizedUserRole;
  organizationMemberRoles: string[];
  employee: CentralizedEmployee | null;
  loading: boolean;
  centralProfileHydrated: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasOrganization: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  displayName: string;
  organizationName: string;
  refreshUserData: () => Promise<void>;
  forceRefreshUserData: () => Promise<void>;
  clearOrganizationSession: () => void;
  organizationAccessState: OrganizationAccessState;
}

export const CentralizedUserDataContext = createContext<
  CentralizedUserDataContextType | undefined
>(undefined);

/** Default saat hook dipanggil di luar provider (mis. saat HMR / React Fast Refresh). */
export const DEFAULT_CENTRALIZED_USER_DATA: CentralizedUserDataContextType = {
  user: null,
  userData: null,
  organization: null,
  userRole: null,
  organizationMemberRoles: [],
  employee: null,
  loading: true,
  centralProfileHydrated: false,
  error: null,
  isAuthenticated: false,
  isEmailVerified: false,
  hasOrganization: false,
  isOwner: false,
  isAdmin: false,
  displayName: "",
  organizationName: "",
  refreshUserData: async () => {},
  forceRefreshUserData: async () => {},
  clearOrganizationSession: () => {},
  organizationAccessState: "loading",
};
