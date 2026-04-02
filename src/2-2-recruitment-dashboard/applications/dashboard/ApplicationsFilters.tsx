import { Search, Filter, RotateCcw, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export const ApplicationsFilters = () => {
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <div className="relative flex-1 min-w-[150px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Search applications..."
          className="h-9 w-full rounded-md border border-gray-300 pl-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Select defaultValue="all">
        <SelectTrigger className="h-9 w-full text-sm sm:w-[130px]">
          <Filter className="mr-2 h-4 w-4" />
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="reviewed">Reviewed</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all">
        <SelectTrigger className="h-9 w-full text-sm sm:w-[130px]">
          <Calendar className="mr-2 h-4 w-4" />
          <SelectValue placeholder="All Dates" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Dates</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" className="h-9 w-full shrink-0 px-3 sm:w-auto">
        <RotateCcw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
};
