import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/features/ui/use-toast";
import { clearCurrentOrgCacheForUser, setCurrentOrgCacheForUser } from "@/features/1-login/hooks/useCurrentOrgCache";
import { logger } from "@/config/logger";

export interface OrganizationItem {
  id: string;
  company_name: string;
  industry?: string;
}

/** Row shape from user_organizations select (types used when Supabase cannot infer relationships). */
interface UserOrgRow {
  organization_id: string;
}

/** Row shape from profiles select. */
interface ProfileRow {
  active_organization_id: string | null;
}

const queryKey = ["mobile-organization-list"];

async function fetchOrganizationList(): Promise<{
  organizations: OrganizationItem[];
  activeOrganizationId: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { organizations: [], activeOrganizationId: null };
  }

  const { data: userOrgsRaw } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const userOrgs = (userOrgsRaw ?? []) as unknown as UserOrgRow[];
  if (!userOrgs.length) {
    return { organizations: [], activeOrganizationId: null };
  }

  const orgIds = userOrgs.map((uo) => uo.organization_id);
  const { data: orgsDataRaw } = await supabase
    .from("organizations")
    .select("id, company_name, industry")
    .in("id", orgIds);

  const organizations: OrganizationItem[] = (orgsDataRaw ?? []) as unknown as OrganizationItem[];

  const { data: profileDataRaw } = await supabase
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileData = profileDataRaw as unknown as ProfileRow | null;
  const activeOrganizationId = profileData?.active_organization_id ?? null;
  return { organizations, activeOrganizationId };
}

export function useOrganizationList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [switchingOrganization, setSwitchingOrganization] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: fetchOrganizationList,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const organizations = data?.organizations ?? [];
  const activeOrganizationId = data?.activeOrganizationId ?? null;
  const activeOrganization = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  const switchOrganization = useCallback(
    async (organizationId: string, onSwitched?: (organizationId: string) => void) => {
      if (switchingOrganization) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const selectedOrg = organizations.find((o) => o.id === organizationId);
      if (!selectedOrg) return;

      try {
        setSwitchingOrganization(true);

        const { error } = await supabase
          .from("profiles")
          .update({
            active_organization_id: organizationId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;

        clearCurrentOrgCacheForUser(user.id);
        setCurrentOrgCacheForUser(user.id, organizationId);
        window.dispatchEvent(new CustomEvent("organization-switched", { detail: { organizationId } }));

        await queryClient.invalidateQueries({ queryKey });

        toast({
          title: "Berhasil",
          description: `Berhasil beralih ke ${selectedOrg.company_name}`,
        });

        onSwitched?.(organizationId);
      } catch (err) {
        logger.error("Switch organization failed", err);
        toast({
          title: "Error",
          description: "Gagal beralih organisasi. Silakan coba lagi.",
          variant: "destructive",
        });
      } finally {
        setSwitchingOrganization(false);
      }
    },
    [organizations, switchingOrganization, toast, queryClient]
  );

  return {
    organizations,
    activeOrganizationId,
    activeOrganization,
    loading: isLoading,
    switchingOrganization,
    switchOrganization,
    refetch,
  };
}
