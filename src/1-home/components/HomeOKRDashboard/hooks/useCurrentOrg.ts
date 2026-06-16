/**
 * @deprecated Use `@/shared/auth/hooks/useCurrentOrg` — duplicate local fetch removed
 * to avoid extra `auth.getUser()` + `profiles` requests on Home.
 */
export {
  useCurrentOrg,
  getCurrentOrganizationId,
} from '@/shared/auth/hooks/useCurrentOrg';
