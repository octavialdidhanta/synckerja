import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/shared/components/ui/command';

interface ClientVisitsFiltersProps {
  filters: {
    search: string;
    employee: string;
    date: string;
    status: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const ClientVisitsFilters = ({ filters, onFiltersChange }: ClientVisitsFiltersProps) => {
  const { data: employees = [], isLoading: isLoadingEmployees } = useAvailableEmployees();
  const [employeeOpen, setEmployeeOpen] = React.useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onFiltersChange({
      search: '',
      employee: '',
      date: 'all',
      status: 'all'
    });
  };

  const selectedEmployee = employees.find(emp => emp.id === filters.employee);

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

      {/* Employee Filter */}
      <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={employeeOpen}
            className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left justify-between"
          >
            <span className="truncate">
              {selectedEmployee ? selectedEmployee.full_name : "All Employees"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search employee..." 
              className="h-8 text-xs"
            />
            <CommandList>
              <CommandEmpty>{isLoadingEmployees ? "\u00a0" : "No employee found."}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => {
                    handleFilterChange('employee', '');
                    setEmployeeOpen(false);
                  }}
                >
                  <span className="text-xs">All Employees</span>
                </CommandItem>
                {employees.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={employee.full_name}
                    onSelect={() => {
                      handleFilterChange('employee', employee.id);
                      setEmployeeOpen(false);
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
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
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
          <SelectItem value="ongoing">Ongoing</SelectItem>
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
    </div>
  );
};
