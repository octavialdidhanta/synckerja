import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface OKRSidebarFooterProps {
  totalCycles: number;
  activeCycleId?: string;
}

export function OKRSidebarFooter({ totalCycles }: OKRSidebarFooterProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language.startsWith("id") ? idLocale : enUS;
  const dateStr = format(new Date(), "MMM d", { locale: loc });

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-1">
          <Calendar className="h-3 w-3 shrink-0" aria-hidden />
          <span>{t("layout.okr.sidebar.footer.cycles", { count: totalCycles })}</span>
        </div>
        <span className="text-xs text-muted-foreground/80">{dateStr}</span>
      </div>
    </div>
  );
}
