interface TaskSidebarFooterProps {
  totalTasks: number;
  thisWeek: number;
  completionRate: number;
}

export const TaskSidebarFooter = ({ totalTasks, thisWeek, completionRate }: TaskSidebarFooterProps) => {
  return (
    <div className="flex min-w-0 shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-gray-500">
        <span>Total Tasks: {totalTasks}</span>
        <span className="text-xs text-gray-400">Completion: {completionRate}%</span>
      </div>
    </div>
  );
};

