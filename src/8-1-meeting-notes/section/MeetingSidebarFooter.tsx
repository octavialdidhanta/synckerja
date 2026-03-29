interface MeetingSidebarFooterProps {
  totalMeetings: number;
  thisMonth: number;
  completionRate: number;
}

export const MeetingSidebarFooter = ({ totalMeetings, thisMonth, completionRate }: MeetingSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Total Points: {totalMeetings}</span>
        <span className="text-xs text-gray-400">Completion: {completionRate}%</span>
      </div>
    </div>
  );
};

