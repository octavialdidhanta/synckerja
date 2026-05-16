import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  computeSurveyPromoterStatus,
  type SurveyPromoterStatusKind,
} from "@/features/customer-survey/core/surveyPromoterTarget";
import { cn } from "@/shared/lib/utils";

type Props = {
  responseCount: number;
  promoterPct: number;
  targetPct: number | null | undefined;
  className?: string;
};

function badgeClass(kind: SurveyPromoterStatusKind): string {
  switch (kind) {
    case "achieve":
      return "border-green-200 bg-green-50 text-green-800 hover:bg-green-50";
    case "failed":
      return "border-red-200 bg-red-50 text-red-800 hover:bg-red-50";
    case "insufficient_data":
      return "border-border bg-muted/50 text-muted-foreground hover:bg-muted/50";
    default:
      return "border-border bg-muted/30 text-muted-foreground hover:bg-muted/30";
  }
}

function labelKey(kind: SurveyPromoterStatusKind): string {
  switch (kind) {
    case "achieve":
      return "crm.customerSurvey.statusAchieve";
    case "failed":
      return "crm.customerSurvey.statusFailed";
    case "insufficient_data":
      return "crm.customerSurvey.statusInsufficientData";
    default:
      return "crm.customerSurvey.statusNoTarget";
  }
}

export function SurveyPromoterStatusBadge({ responseCount, promoterPct, targetPct, className }: Props) {
  const { t } = useAppTranslation();
  const kind = computeSurveyPromoterStatus(responseCount, promoterPct, targetPct);
  const label = t(labelKey(kind), kind === "achieve" ? "Achieve" : kind === "failed" ? "Failed" : kind === "insufficient_data" ? "Insufficient data" : "—");

  return (
    <Badge variant="outline" className={cn("font-medium tabular-nums", badgeClass(kind), className)}>
      {label}
    </Badge>
  );
}
