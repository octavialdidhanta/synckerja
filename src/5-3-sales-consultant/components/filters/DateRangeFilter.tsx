import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

export interface DateFilterOption {
  value: string;
  label: string;
  range: DateRange;
}

interface DateRangeFilterProps {
  onDateRangeChange: (range: DateRange | null) => void;
  className?: string;
}

export const DateRangeFilter = ({ onDateRangeChange, className }: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('maximum');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [displayText, setDisplayText] = useState('Maximum');

  const today = new Date();
  const yesterday = subDays(today, 1);

  const dateOptions: DateFilterOption[] = [
    {
      value: 'today',
      label: 'Today',
      range: { from: startOfDay(today), to: endOfDay(today) }
    },
    {
      value: 'yesterday',
      label: 'Yesterday',
      range: { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    },
    {
      value: 'last7days',
      label: 'Last 7 days',
      range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) }
    },
    {
      value: 'last14days',
      label: 'Last 14 days',
      range: { from: startOfDay(subDays(today, 13)), to: endOfDay(today) }
    },
    {
      value: 'last28days',
      label: 'Last 28 days',
      range: { from: startOfDay(subDays(today, 27)), to: endOfDay(today) }
    },
    {
      value: 'last30days',
      label: 'Last 30 days',
      range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) }
    },
    {
      value: 'thisweek',
      label: 'This week',
      range: { from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfWeek(today, { weekStartsOn: 0 }) }
    },
    {
      value: 'lastweek',
      label: 'Last week',
      range: { from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }), to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }) }
    },
    {
      value: 'thismonth',
      label: 'This month',
      range: { from: startOfMonth(today), to: endOfMonth(today) }
    },
    {
      value: 'lastmonth',
      label: 'Last month',
      range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) }
    },
    {
      value: 'maximum',
      label: 'Maximum',
      range: { from: undefined, to: undefined }
    }
  ];

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    const option = dateOptions.find(opt => opt.value === value);
    
    if (option) {
      if (value === 'maximum') {
        setDisplayText('Maximum');
        onDateRangeChange(null);
      } else if (value === 'custom') {
        setDisplayText('Custom');
        // Keep current custom range
      } else {
        const formatStr = 'dd MMM yyyy';
        if (option.range.from && option.range.to) {
          if (option.range.from.getTime() === option.range.to.getTime()) {
            setDisplayText(format(option.range.from, formatStr));
          } else {
            setDisplayText(`${format(option.range.from, formatStr)} - ${format(option.range.to, formatStr)}`);
          }
        }
        onDateRangeChange(option.range);
      }
    }
  };

  const handleCustomRangeChange = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setSelectedOption('custom');
      const formatStr = 'dd MMM yyyy';
      setDisplayText(`${format(range.from, formatStr)} - ${format(range.to, formatStr)}`);
      onDateRangeChange(range);
    }
  };

  const handleUpdate = () => {
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-start text-left font-normal w-[200px] h-8 text-xs ${className}`}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Left side - Radio options */}
          <div className="w-48 p-4 border-r">
            <RadioGroup value={selectedOption} onValueChange={handleOptionChange}>
              {dateOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="text-sm font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="text-sm font-normal cursor-pointer">
                  Custom
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Right side - Calendar */}
          <div className="p-4">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={handleCustomRangeChange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
            
            {/* Date display and timezone info */}
            <div className="mt-4 pt-4 border-t">
              {customRange?.from && customRange?.to && (
                <div className="text-sm text-center mb-2">
                  {format(customRange.from, 'dd MMM yyyy')} - {format(customRange.to, 'dd MMM yyyy')}
                </div>
              )}
              <div className="text-xs text-gray-500 text-center mb-4">
                Dates are shown in Jakarta Time
              </div>
              
              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUpdate}>
                  Update
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
