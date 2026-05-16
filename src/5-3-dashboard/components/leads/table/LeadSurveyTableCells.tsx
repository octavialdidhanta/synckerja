import { History } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { SurveyStarDisplay } from "@/features/customer-survey/public/SurveyStarDisplay";
import { isWhatsappLeadForSurvey } from "@/features/customer-survey/core/resolveWhatsappConversationId";
import type { LatestCustomerSurvey } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";
import type { NewLead } from "@/shared/types/leads";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  lead: NewLead;
  survey: LatestCustomerSurvey | null;
  onOpenHistory?: (lead: NewLead) => void;
  historyDisabled?: boolean;
};

export function LeadSurveyRatingCell({ lead, survey }: Pick<Props, "lead" | "survey">) {
  const isWa = isWhatsappLeadForSurvey(lead);
  const rating = isWa && survey ? survey.rating : null;
  return <SurveyStarDisplay rating={rating} size="sm" />;
}

export function LeadSurveyHistoryCell({ lead, survey, onOpenHistory, historyDisabled }: Props) {
  const { t } = useAppTranslation();
  const isWa = isWhatsappLeadForSurvey(lead);
  const canOpen = isWa && Boolean(survey) && !historyDisabled && Boolean(onOpenHistory);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 hover:bg-muted"
      disabled={!canOpen}
      onClick={() => canOpen && onOpenHistory?.(lead)}
      title={t("leadsManagement.viewSurveyHistory", "Lihat riwayat survei")}
      aria-label={t("leadsManagement.viewSurveyHistory", "Lihat riwayat survei")}
    >
      <History className="h-3.5 w-3.5 text-gray-600" />
    </Button>
  );
}

export function LeadSurveyCommentCell({ lead, survey }: Pick<Props, "lead" | "survey">) {
  const isWa = isWhatsappLeadForSurvey(lead);
  const text = isWa && survey?.comment?.trim() ? survey.comment.trim() : "";

  if (!text) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-[180px] truncate text-sm text-foreground">{text}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
