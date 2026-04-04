import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface KOLCampaignsTableFooterProps {
  totalCampaigns: number;
  activeCampaigns: number;
  filteredCampaigns?: number;
  selectedStatus?: string;
}

export const KOLCampaignsTableFooter = ({
  totalCampaigns,
  activeCampaigns,
  filteredCampaigns = totalCampaigns,
  selectedStatus,
}: KOLCampaignsTableFooterProps) => {
  const { t } = useAppTranslation();
  const statusText =
    selectedStatus && selectedStatus !== "all"
      ? ` ${t("kolCampaigns.table.footer.inStatus", "in")} ${selectedStatus}`
      : "";

  return (
    <div className="flex-shrink-0 border-t border-brand-blue/20 bg-brand-blue-soft px-4 py-2">
      <div className="flex items-center justify-between text-xs text-brand-blue-on-soft">
        <span>
          {t("kolCampaigns.table.footer.showing", "Showing")} {filteredCampaigns}{" "}
          {t("kolCampaigns.table.footer.of", "of")} {totalCampaigns}{" "}
          {t("kolCampaigns.table.footer.campaigns", "campaigns")}
          {statusText}
        </span>
        <span className="text-xs text-brand-blue/80">
          {t("kolCampaigns.table.footer.total", "Total")}: {totalCampaigns}{" "}
          {t("kolCampaigns.table.footer.campaigns", "campaigns")} ·{" "}
          {t("kolCampaigns.table.footer.active", "Active")}: {activeCampaigns}
        </span>
      </div>
    </div>
  );
};

