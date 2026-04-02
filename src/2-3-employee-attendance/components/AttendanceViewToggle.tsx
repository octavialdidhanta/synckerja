
import { Calendar, List } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface AttendanceViewToggleProps {
  currentView: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}

export const AttendanceViewToggle = ({ currentView, onViewChange }: AttendanceViewToggleProps) => {
  return (
    <div className="bg-muted flex items-center rounded-lg p-1">
      <Button
        variant={currentView === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('table')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-xs font-medium',
          currentView === 'table' && 'shadow-sm',
        )}
      >
        <List className="h-3.5 w-3.5" />
        Table View
      </Button>
      <Button
        variant={currentView === 'calendar' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('calendar')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-xs font-medium',
          currentView === 'calendar' && 'shadow-sm',
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        Calendar View
      </Button>
    </div>
  );
};
