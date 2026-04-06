import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/shared/components/ui/command';

interface VisitSchedulingFiltersProps {
  filters: {
    search: string;
    salesPerson: string;
    date: string;
    status: string;
  };
  onFiltersChange: (filters: any) => void;
  onNewVisit?: () => void;
}

export const VisitSchedulingFilters = ({ filters, onFiltersChange, onNewVisit }: VisitSchedulingFiltersProps) => {
  const { data: employees = [], isLoading: isLoadingEmployees } = useAvailableEmployees();
  const [salesPersonOpen, setSalesPersonOpen] = React.useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onFiltersChange({
      search: '',
      salesPerson: '',
      date: 'all',
      status: 'all'
    });
  };

  const selectedEmployee = employees.find(emp => emp.id === filters.salesPerson);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[150px]">
        <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
        <Input
          type="text"
          placeholder="Search visits..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="w-full pl-4 pr-10 h-9 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* Sales Person Filter */}
      <Popover open={salesPersonOpen} onOpenChange={setSalesPersonOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={salesPersonOpen}
            className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left justify-between"
          >
            <span className="truncate">
              {selectedEmployee ? selectedEmployee.full_name : "All Sales Person"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search sales person..." 
              className="h-8 text-xs"
            />
            <CommandList>
              <CommandEmpty>
                {isLoadingEmployees ? "Loading employees..." : "No sales person found."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => {
                    handleFilterChange('salesPerson', '');
                    setSalesPersonOpen(false);
                  }}
                >
                  <span className="text-xs">All Sales Person</span>
                </CommandItem>
                {employees.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={employee.full_name}
                    onSelect={() => {
                      handleFilterChange('salesPerson', employee.id);
                      setSalesPersonOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{employee.full_name}</span>
                      <span className="text-xs text-gray-500">{employee.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Date Filter */}
      <Select value={filters.date} onValueChange={(value) => handleFilterChange('date', value)}>
        <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
          <SelectValue placeholder="Date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="tomorrow">Tomorrow</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="next_week">Next Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
        <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      <button
        onClick={handleClear}
        className="h-9 px-3 hover:bg-gray-100 rounded-md transition-colors border border-gray-300 flex items-center justify-center"
        title="Clear all filters"
      >
        <RefreshCw className="w-4 h-4 text-gray-500" />
      </button>

      {onNewVisit && (
        <Button onClick={onNewVisit} className="h-9 px-3 text-sm">
          <Plus className="mr-1 h-4 w-4" />
          New Visit
        </Button>
      )}
    </div>
  );
};
