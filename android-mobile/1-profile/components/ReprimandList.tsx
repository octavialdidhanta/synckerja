import { ChevronRight } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/mobile-app/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { ProfileReprimandRecord } from '@/mobile/1-profile/hooks/useProfileReprimands';
import {
  formatIncidentDate,
  getReprimandListSummary,
  getSeverityBadgeClass,
  getStatusBadgeClass,
} from '@/mobile/1-profile/utils/reprimandDisplayUtils';

interface ReprimandListProps {
  reprimands: ProfileReprimandRecord[];
  onSelect: (reprimand: ProfileReprimandRecord) => void;
}

export const ReprimandList = ({ reprimands, onSelect }: ReprimandListProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      {reprimands.map((reprimand) => {
        const summary = getReprimandListSummary(reprimand, t);
        const incidentDate = formatIncidentDate(reprimand.incident_date, language);

        return (
          <button
            key={reprimand.id}
            type="button"
            className="w-full text-left"
            onClick={() => onSelect(reprimand)}
          >
            <Card className="border border-border bg-gradient-card transition-colors hover:bg-muted/30">
              <div className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getSeverityBadgeClass(reprimand.severity_level)}`}
                    >
                      {summary.severityLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusBadgeClass(reprimand.status)}`}
                    >
                      {summary.statusLabel}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{summary.typeLabel}</p>
                    {incidentDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{incidentDate}</p>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {reprimand.violation_description}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
};
