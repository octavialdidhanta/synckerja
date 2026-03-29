interface TaskSidebarFooterProps {
  totalTasks: number;
  thisWeek: number;
  completionRate: number;
}

export const TaskSidebarFooter = ({ totalTasks, thisWeek, completionRate }: TaskSidebarFooterProps) => {
  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Total Tasks: {totalTasks}</span>
        <span className="text-xs text-gray-400">Completion: {completionRate}%</span>
      </div>
    </div>
  );
};

