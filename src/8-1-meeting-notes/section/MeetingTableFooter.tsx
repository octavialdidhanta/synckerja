import './MeetingPointsTable.css';

interface MeetingTableFooterProps {
  totalMeetingPoints: number;
  filteredPoints: number;
}

export const MeetingTableFooter = ({ totalMeetingPoints, filteredPoints }: MeetingTableFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Total Meeting Points: {totalMeetingPoints}</span>
        <span className="text-xs text-gray-400">
          {totalMeetingPoints > 0 ? `Showing ${filteredPoints} points` : 'No meeting points yet'}
        </span>
      </div>
    </div>
  );
};

