
import { AlertTriangle, Clock, CheckCircle, XCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { useMeetingNotes } from '../MeetingNotesContext';

interface SummaryData {
  label: string;
  count: number;
  color: string;
  icon: any;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const MeetingSummaryCards = () => {
  const { summaryData, recentUpdates, isLoading } = useMeetingNotes();

  const summaryCards: SummaryData[] = [
    { 
      label: 'Not Started', 
      count: summaryData.notStarted, 
      color: 'orange', 
      icon: AlertTriangle, 
      bgColor: 'bg-orange-50', 
      textColor: 'text-orange-600', 
      borderColor: 'border-orange-200' 
    },
    { 
      label: 'On Going', 
      count: summaryData.onGoing, 
      color: 'blue', 
      icon: Clock, 
      bgColor: 'bg-blue-50', 
      textColor: 'text-blue-600', 
      borderColor: 'border-blue-200' 
    },
    { 
      label: 'Completed', 
      count: summaryData.completed, 
      color: 'green', 
      icon: CheckCircle, 
      bgColor: 'bg-green-50', 
      textColor: 'text-green-600', 
      borderColor: 'border-green-200' 
    },
    { 
      label: 'Rejected', 
      count: summaryData.rejected, 
      color: 'red', 
      icon: XCircle, 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-600', 
      borderColor: 'border-red-200' 
    },
    { 
      label: 'Presented', 
      count: summaryData.presented, 
      color: 'purple', 
      icon: MessageSquare, 
      bgColor: 'bg-purple-50', 
      textColor: 'text-purple-600', 
      borderColor: 'border-purple-200' 
    },
    { 
      label: 'Updates', 
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
        <div className="text-center text-gray-500">Loading summary...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <div
              key={index}
              className={`${item.bgColor} ${item.borderColor} border rounded-lg p-3 flex items-center justify-between min-h-[60px]`}
            >
              <div className="flex items-center gap-2">
                <IconComponent className={`w-4 h-4 ${item.textColor}`} />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <span className={`text-xl font-bold ${item.textColor}`}>{item.count}</span>
            </div>
          );
        })}
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
        <h4 className="font-semibold text-gray-900 text-sm mb-2">Recent Updates</h4>
        {recentUpdates.length === 0 ? (
          <p className="text-sm text-gray-500">No recent updates.</p>
        ) : (
          <div className="space-y-2">
            {recentUpdates.map((update) => (
              <div key={update.id} className="bg-gray-50 rounded-md p-2 border-l-4 border-blue-400">
                <div className="text-xs text-gray-500 mb-1">
                  {formatDate(update.created_at)} • {(update.meeting_point_solutions?.solution_description ?? 'Update').substring(0, 30)}...
                </div>
                <div className="text-sm text-gray-700">
                  {(update.update_details ?? '').substring(0, 80)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingSummaryCards;
