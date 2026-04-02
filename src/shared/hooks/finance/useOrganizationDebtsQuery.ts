import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  ORGANIZATION_DEBTS_QUERY_KEY,
  fetchOrganizationDebts,
  type OrganizationDebtsQueryData,
} from "@/shared/lib/organizationDebtsQuery";

export function useOrganizationDebtsQuery() {
  const { organizationId } = useCurrentOrg();
  const { t } = useAppTranslation();

  return useQuery<OrganizationDebtsQueryData>({
    queryKey: organizationId ? ORGANIZATION_DEBTS_QUERY_KEY(organizationId) : ["organization-debts", "none"],
    queryFn: async () => {
      if (!organizationId) {
        return { debts: [], totalInterestYtd: 0 };
      }
      try {
        return await fetchOrganizationDebts(organizationId);
      } catch (e) {
        console.error("Error fetching debts:", e);
        toast.error(t("debt.error.loadFailed", "Failed to load debt data"));
        throw e;
      }
    },
    enabled: !!organizationId,
  });
}
