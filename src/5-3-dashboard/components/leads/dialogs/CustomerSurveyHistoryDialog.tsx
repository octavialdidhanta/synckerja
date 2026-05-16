import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { SurveyStarDisplay } from "@/features/customer-survey/public/SurveyStarDisplay";
import { useCustomerSurveyHistory } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";

type Props = {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
  leadTitle: string;
};

export function CustomerSurveyHistoryDialog({ open, onClose, conversationId, leadTitle }: Props) {
  const { t } = useTranslation();
  const { data: history = [], isLoading, isError } = useCustomerSurveyHistory(conversationId, open);

  const formatDateTime = (iso: string) => {
    try {
      return format(new Date(iso), "dd MMM yyyy, HH:mm");
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("leadsManagement.surveyHistoryTitle", "Riwayat survei")}</DialogTitle>
          <DialogDescription className="truncate">{leadTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("common.loading", "Memuat…")}</span>
          </div>
        ) : isError ? (
          <p className="py-6 text-sm text-destructive">
            {t("leadsManagement.surveyHistoryLoadError", "Gagal memuat riwayat survei.")}
          </p>
        ) : history.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("leadsManagement.surveyHistoryEmpty", "Belum ada respons survei untuk chat ini.")}
          </p>
        ) : (
          <ScrollArea className="max-h-[min(60vh,480px)] pr-3">
            <ul className="space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatDateTime(entry.submittedAt)}</span>
                    <SurveyStarDisplay rating={entry.rating} size="md" />
                  </div>
                  {entry.comment?.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.comment}</p>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      {t("leadsManagement.surveyHistoryNoComment", "Tanpa keterangan")}
                    </p>
                  )}
                  {entry.assigneeName?.trim() ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" aria-hidden />
                      {entry.assigneeName}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
