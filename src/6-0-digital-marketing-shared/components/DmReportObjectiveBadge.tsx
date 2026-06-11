import { Link } from "react-router-dom";
import { Badge } from "@/shared/components/ui/badge";
import { DM_REPORT_TARGETS_PATH } from "@/6-0-digital-marketing-shared/dmReportTargetPaths";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  className?: string;
};

export function DmReportObjectiveBadge({ className }: Props) {
  const { t } = useAppTranslation();

  return (
    <Link
      to={DM_REPORT_TARGETS_PATH}
      onClick={(e) => e.stopPropagation()}
      className={className}
      title={t(
        "digitalMarketing.dmReportTargets.openTargetsSettings",
        "Open Report KPI targets",
      )}
    >
      <Badge
        variant="outline"
        className="border-sky-300 bg-sky-50 text-[10px] text-sky-800 hover:bg-sky-100"
      >
        {t("digitalMarketing.dmReportTargets.paidAdsBadge", "Paid Ads KPI")}
      </Badge>
    </Link>
  );
}
