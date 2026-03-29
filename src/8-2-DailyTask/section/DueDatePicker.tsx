import React from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CustomDatePicker } from '@/shared/calendar';
import { format } from 'date-fns';

interface DueDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const DueDatePicker = ({ value, onChange, disabled = false }: DueDatePickerProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const selectedDate = value ? new Date(value) : undefined;
  
  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={disabled}
        >
          <Calendar className="w-4 h-4 mr-2 text-gray-500" />
          {selectedDate ? (
            <span className="text-gray-900">{format(selectedDate, 'MMM dd, yyyy')}</span>
          ) : (
            <span className="text-gray-500">Select due date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-gray-200 rounded-lg shadow-lg" align="center">
        <div className="p-2">
          <CustomDatePicker
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="border-0 shadow-none"
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
          {selectedDate && (
            <div className="flex justify-center pt-2 border-t mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDate}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                Clear Date
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
