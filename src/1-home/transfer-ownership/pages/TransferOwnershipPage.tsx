import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useHeaderUserProfile } from "@/shared/hooks/useHeaderUserProfile";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import { TransferOwnershipForm } from "../components/TransferOwnershipForm";
import { PendingTransfersList } from "../components/PendingTransfersList";
import { IncomingTransfersList } from "../components/IncomingTransfersList";
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
    transfers,
    pendingTransfers,
    organizationMembers,
    fetchPendingTransfers,
    cancelTransfer,
    initiateTransfer,
    acceptTransfer,
    loading: transferLoading,
    incomingReady,
    accepting,
    membersLoading,
  } = useTransferOwnership(activeOrganization?.id ?? null);

  const isOwner = userRole.toLowerCase() === "owner";

  const acceptIncoming = async (transferId: string) => {
    const accepted = await acceptTransfer(transferId);
    if (accepted) navigate("/");
  };

  if (loading || (!isOwner && !incomingReady)) {
    return <LoadingView />;
  }

  if (!isOwner) {
    return (
      <main className="bg-muted/40 p-6 pb-8 dark:bg-background">
        <div className="container mx-auto max-w-2xl px-0">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t("transferOwnership.page.backToDashboard")}
          </Button>

          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
              {t("transferOwnership.incoming.title")}
            </h2>
            <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/80">
              {t("transferOwnership.incoming.subtitle")}
            </p>
          </div>

          <IncomingTransfersList transfers={transfers} accepting={accepting} onAccept={acceptIncoming} />
        </div>
      </main>
    );
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
