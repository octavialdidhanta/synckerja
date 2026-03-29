import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/hooks/use-toast";
import { useHeaderUserProfile } from "@/shared/hooks/useHeaderUserProfile";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import { TransferOwnershipForm } from "../components/TransferOwnershipForm";
import { PendingTransfersList } from "../components/PendingTransfersList";
import { AccessDeniedView } from "../components/AccessDeniedView";
import { LoadingView } from "../components/LoadingView";

export default function TransferOwnershipPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role: userRole, isLoading: headerLoading } = useHeaderUserProfile();
  const { data: orgData, isLoading: orgLoading } = useUserOrganizations();

  const activeOrganization = useMemo(() => {
    const id = orgData?.activeOrganizationId ?? null;
    if (!id) return null;
    const m = orgData?.memberships.find((x) => x.organizationId === id);
    if (!m) return null;
    return { id, company_name: m.companyName };
  }, [orgData]);

  const loading = headerLoading || orgLoading;

  const {
    pendingTransfers,
    organizationMembers,
    fetchPendingTransfers,
    cancelTransfer,
    initiateTransfer,
    loading: transferLoading,
    membersLoading,
  } = useTransferOwnership(activeOrganization?.id ?? null);

  const isOwner = userRole.toLowerCase() === "owner";

  useEffect(() => {
    if (!loading && !isOwner) {
      toast({
        title: t("transferOwnership.page.accessDeniedToastTitle"),
        description: t("transferOwnership.page.accessDeniedToastDescription"),
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loading, isOwner, navigate, t]);

  if (loading) {
    return <LoadingView />;
  }

  if (!isOwner) {
    return <AccessDeniedView />;
  }

  if (!activeOrganization) {
    return <LoadingView />;
  }

  return (
    <main className="bg-muted/40 p-6 pb-8 dark:bg-background">
      <div className="container mx-auto max-w-2xl px-0">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          {t("transferOwnership.page.backToDashboard")}
        </Button>

        <div className="mb-6 rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4 dark:border-brand-blue/40 dark:bg-brand-blue/10">
          <h2 className="text-lg font-semibold text-brand-blue">
            {t("transferOwnership.page.heroTitle", { company: activeOrganization.company_name })}
          </h2>
          <p className="mt-1 text-sm text-brand-blue/90 dark:text-brand-blue/80">{t("transferOwnership.page.heroSubtitle")}</p>
        </div>

        <div className="space-y-6">
          <TransferOwnershipForm
            members={organizationMembers}
            onTransferComplete={fetchPendingTransfers}
            initiateTransfer={initiateTransfer}
            loading={transferLoading}
            membersLoading={membersLoading}
          />

          <PendingTransfersList transfers={pendingTransfers} onCancelTransfer={cancelTransfer} />
        </div>
      </div>
    </main>
  );
}
