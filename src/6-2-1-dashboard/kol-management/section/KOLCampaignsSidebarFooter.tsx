import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface KOLCampaignsSidebarFooterProps {
  totalCampaigns: number;
  activeCampaigns: number;
  selectedStatus?: string;
}

export const KOLCampaignsSidebarFooter = ({
  totalCampaigns,
  activeCampaigns,
  selectedStatus,
}: KOLCampaignsSidebarFooterProps) => {
  const { t } = useAppTranslation();
  const statusText =
    selectedStatus && selectedStatus !== "all"
      ? ` ${t("kolCampaigns.sidebar.footer.inStatus", "in")} ${selectedStatus}`
      : "";

  return (
    <div className="flex-shrink-0 border-t border-brand-blue/20 bg-brand-blue-soft px-4 py-2">
      <div className="flex items-center justify-between text-xs text-brand-blue-on-soft">
        <span>
          {t("kolCampaigns.sidebar.footer.active", "Active")}: {activeCampaigns}
          {statusText}
        </span>
        <span className="text-xs text-brand-blue/80">
          {t("kolCampaigns.sidebar.footer.total", "Total")}: {totalCampaigns}{" "}
          {t("kolCampaigns.sidebar.footer.campaigns", "campaigns")}
        </span>
      </div>
    </div>
  );
};

