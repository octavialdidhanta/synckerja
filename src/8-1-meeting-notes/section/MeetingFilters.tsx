
import { Search, Filter, ChevronDown, Calendar } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useMeetingNotes } from '../MeetingNotesContext';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

const MeetingFilters = () => {
  const { 
    filters, 
    setFilters, 
    meetingPoints 
  } = useMeetingNotes();
  
  const { data: employees = [] } = useAvailableEmployees();

  // Get unique request by names from meeting points
  const uniqueRequestBy = Array.from(
    new Set(
      meetingPoints
        .map(point => point.request_by)
        .filter(Boolean)
    )
  );

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status === 'All Statuses' ? '' : status }));
  };

  const handleRequestByFilter = (requestBy: string) => {
    setFilters(prev => ({ ...prev, requestBy: requestBy === 'All Request By' ? '' : requestBy }));
  };

  const handleTimeFilter = (timeFilter: string) => {
    setFilters(prev => ({ ...prev, timeFilter: timeFilter === 'All Time' ? '' : timeFilter }));
  };

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-600" />
        <span className="text-lg font-medium text-gray-900">{new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search discussion points..."
          className="pl-10 h-9 text-sm border-gray-200"
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 text-sm border-gray-200">
            {filters.status || 'All Statuses'}
            <ChevronDown className="ml-1 w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white z-50">
          <DropdownMenuItem onClick={() => handleStatusFilter('All Statuses')}>
            All Statuses
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusFilter('Not Started')}>
            Not Started
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusFilter('On Going')}>
            On Going
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusFilter('Completed')}>
            Completed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusFilter('Rejected')}>
            Rejected
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusFilter('Presented')}>
            Presented
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 text-sm border-gray-200">
            {filters.requestBy || 'All Request By'}
            <ChevronDown className="ml-1 w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white z-50">
          <DropdownMenuItem onClick={() => handleRequestByFilter('All Request By')}>
            All Request By
          </DropdownMenuItem>
          {uniqueRequestBy.map((name, index) => (
            <DropdownMenuItem key={name ?? `request-by-${index}`} onClick={() => handleRequestByFilter(name!)}>
              {name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 text-sm border-gray-200 min-w-[120px]">
            {filters.timeFilter || 'All Time'}
            <ChevronDown className="ml-1 w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white z-50">
          <DropdownMenuItem onClick={() => handleTimeFilter('All Time')}>
            All Time
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTimeFilter('Today')}>
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTimeFilter('Yesterday')}>
            Yesterday
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTimeFilter('This Week')}>
            This Week
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTimeFilter('This Month')}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTimeFilter('Last Month')}>
            Last Month
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>
  );
};

export default MeetingFilters;
