
import { Calendar, List, Grid } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface AttendanceViewToggleProps {
  currentView: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}

export const AttendanceViewToggle = ({ currentView, onViewChange }: AttendanceViewToggleProps) => {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <Button
        variant={currentView === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('table')}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
          currentView === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200'
        }`}
      >
        <List className="h-3.5 w-3.5" />
        Table View
      </Button>
      <Button
        variant={currentView === 'calendar' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('calendar')}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
          currentView === 'calendar' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200'
        }`}
      >
        <Calendar className="h-3.5 w-3.5" />
        Calendar View
      </Button>
    </div>
  );
};
