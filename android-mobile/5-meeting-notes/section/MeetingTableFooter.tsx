import './MeetingPointsTable.css';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface MeetingTableFooterProps {
  totalMeetingPoints: number;
  filteredPoints: number;
}

export const MeetingTableFooter = ({ totalMeetingPoints, filteredPoints }: MeetingTableFooterProps) => {
  const { t } = useAppTranslation();
  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-2.5 py-1.5">
      <div className="flex flex-col items-start justify-between gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <span className="break-words">
          {t('meetingNotes.footer.totalPoints', 'Total Meeting Points')}: {totalMeetingPoints}
        </span>
        <span className="text-xs text-muted-foreground">
          {totalMeetingPoints > 0
            ? t('meetingNotes.footer.showingPoints', 'Showing {{count}} points', { count: filteredPoints })
            : t('meetingNotes.footer.noPoints', 'No meeting points yet')}
        </span>
      </div>
    </div>
  );
};

