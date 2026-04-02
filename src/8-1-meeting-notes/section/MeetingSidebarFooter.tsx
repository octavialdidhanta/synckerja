interface MeetingSidebarFooterProps {
  totalMeetings: number;
  thisMonth: number;
  completionRate: number;
}

export const MeetingSidebarFooter = ({ totalMeetings, thisMonth, completionRate }: MeetingSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-brand-blue/15 bg-brand-blue/5">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Total Points: {totalMeetings}</span>
        <span className="text-xs text-brand-blue/80">Completion: {completionRate}%</span>
      </div>
    </div>
  );
};

