/**
 * App-wide session, active organization, and centralized profile context.
 * Auth UI routes live in `src/0-auth`, `src/0-register`, and `src/0-onboarding`.
 */
export { useAuth, AuthProvider } from "@/shared/auth/contexts/AuthContext";
export { CurrentOrgProvider } from "@/shared/auth/contexts/CurrentOrgContext";
export { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
export { useCurrentOrg, getCurrentOrganizationId } from "@/shared/auth/hooks/useCurrentOrg";
export { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
export { useUserData } from "@/shared/auth/hooks/useUserData";
export * from "@/shared/auth/utils/authCleanup";
