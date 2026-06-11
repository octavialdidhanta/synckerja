import { Link } from "react-router-dom";
import { Badge } from "@/shared/components/ui/badge";
import { buildInsightTargetsPath } from "@/6-0-social-media-performance-shared/socialMediaInsightPaths";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  period?: InsightTargetPeriodKey;
  className?: string;
};

export function SocialInsightObjectiveBadge({ period, className }: Props) {
  const { t } = useAppTranslation();
  const href = buildInsightTargetsPath(period);

  return (
    <Link
      to={href}
      onClick={(e) => e.stopPropagation()}
      className={className}
      title={t(
        "digitalMarketing.socialMediaInsightTargets.openTargetsSettings",
        "Open Insight KPI targets",
      )}
    >
      <Badge variant="outline" className="border-primary/30 bg-info-muted text-[10px] text-primary hover:bg-accent">
        {t("digitalMarketing.socialMediaInsightTargets.socialInsightBadge", "Social Insight")}
      </Badge>
    </Link>
  );
}
