import './TaskList.css';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface TaskListFooterProps {
  totalTasks: number;
  filteredTasks: number;
  onOpenCreateTemplate?: () => void;
}

export const TaskListFooter = ({ totalTasks, filteredTasks, onOpenCreateTemplate }: TaskListFooterProps) => {
  const { t } = useAppTranslation();
  return (
    <div 
      className="task-list-footer px-4 py-3 flex-shrink-0 relative z-10"
      style={{ 
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
        opacity: 1
      }}
    >
      <div className="flex items-center justify-between text-xs text-gray-700">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800">Total Tasks: {totalTasks}</span>
          <span className="text-xs text-gray-600 font-medium">
            {totalTasks > 0 ? `Showing ${filteredTasks} tasks` : 'No tasks yet'}
          </span>
        </div>
        {onOpenCreateTemplate && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenCreateTemplate}>
            <Plus className="h-4 w-4 mr-1" />
            {t('dailyTask.template.createTemplate') ?? 'Create template'}
          </Button>
        )}
      </div>
    </div>
  );
};





