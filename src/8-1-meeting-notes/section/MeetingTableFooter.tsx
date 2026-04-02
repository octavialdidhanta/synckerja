import './MeetingPointsTable.css';

interface MeetingTableFooterProps {
  totalMeetingPoints: number;
  filteredPoints: number;
}

export const MeetingTableFooter = ({ totalMeetingPoints, filteredPoints }: MeetingTableFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-brand-blue/15 bg-brand-blue/5">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Total Meeting Points: {totalMeetingPoints}</span>
        <span className="text-xs text-brand-blue/80">
          {totalMeetingPoints > 0 ? `Showing ${filteredPoints} points` : 'No meeting points yet'}
        </span>
      </div>
    </div>
  );
};

