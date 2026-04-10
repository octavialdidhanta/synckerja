import { AlertTriangle, Clock, CheckCircle, XCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { useMeetingNotes } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

interface SummaryData {
  labelKey: string;
  count: number;
  color: string;
  icon: any;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const MeetingSummaryCards = () => {
  const { summaryData, recentUpdates, isLoading } = useMeetingNotes();
  const { t } = useAppTranslation();

  const summaryCards: SummaryData[] = [
    { 
      labelKey: 'meetingNotes.filters.notStarted', 
      count: summaryData.notStarted, 
      color: 'orange', 
      icon: AlertTriangle, 
      bgColor: 'bg-orange-50', 
      textColor: 'text-orange-600', 
      borderColor: 'border-orange-200' 
    },
    { 
      labelKey: 'meetingNotes.filters.onGoing', 
      count: summaryData.onGoing, 
      color: 'blue', 
      icon: Clock, 
      bgColor: 'bg-blue-50', 
      textColor: 'text-blue-600', 
      borderColor: 'border-blue-200' 
    },
    { 
      labelKey: 'meetingNotes.filters.completed', 
      count: summaryData.completed, 
      color: 'green', 
      icon: CheckCircle, 
      bgColor: 'bg-green-50', 
      textColor: 'text-green-600', 
      borderColor: 'border-green-200' 
    },
    { 
      labelKey: 'meetingNotes.filters.rejected', 
      count: summaryData.rejected, 
      color: 'red', 
      icon: XCircle, 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-600', 
      borderColor: 'border-red-200' 
    },
    { 
      labelKey: 'meetingNotes.filters.presented', 
      count: summaryData.presented, 
      color: 'purple', 
      icon: MessageSquare, 
      bgColor: 'bg-purple-50', 
      textColor: 'text-purple-600', 
      borderColor: 'border-purple-200' 
    },
    { 
      labelKey: 'meetingNotes.summary.updates', 
      count: summaryData.totalUpdates, 
      color: 'blue', 
      icon: RotateCcw, 
      bgColor: 'bg-blue-50', 
      textColor: 'text-blue-600', 
      borderColor: 'border-blue-200' 
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center text-muted-foreground text-sm">{t('meetingNotes.summary.loadingSummary', 'Loading summary...')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground mb-1.5">{t('meetingNotes.summary.meetingSummary', 'Meeting Summary')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {summaryCards.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <div
              key={index}
              className={`${item.bgColor} ${item.borderColor} border rounded-lg p-2.5 flex items-center justify-between min-h-[55px]`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <IconComponent className={`w-4 h-4 ${item.textColor} flex-shrink-0`} />
                <span className="text-xs md:text-sm font-medium text-gray-700 truncate">{t(item.labelKey, item.labelKey)}</span>
              </div>
              <span className={`text-lg md:text-xl font-bold ${item.textColor} flex-shrink-0 ml-1.5`}>{item.count}</span>
            </div>
          );
        })}
      </div>
      
      <div className="bg-card border border-border rounded-lg p-2.5 md:p-3 mt-3">
        <h4 className="font-semibold text-foreground text-sm mb-1.5">{t('meetingNotes.summary.recentUpdates', 'Recent Updates')}</h4>
        {recentUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('meetingNotes.summary.noRecentUpdates', 'No recent updates.')}</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto seamless-scroll">
            {recentUpdates.map((update) => {
              const discussionLabel = update.meeting_point_solutions?.meeting_points?.discussion_point?.substring(0, 30) ?? 'Update';
              const detailsText = update.update_details?.substring(0, 80) ?? '';
              return (
                <div key={update.id} className="bg-muted/50 rounded-md p-2 border-l-4 border-blue-400">
                  <div className="text-xs text-muted-foreground mb-1 break-words">
                    {formatDate(update.created_at)} • {discussionLabel}{discussionLabel.length >= 30 ? '...' : ''}
                  </div>
                  <div className="text-sm text-foreground break-words">
                    {detailsText}{detailsText.length >= 80 ? '...' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingSummaryCards;

