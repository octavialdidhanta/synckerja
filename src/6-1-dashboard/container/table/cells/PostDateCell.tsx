
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';

interface PostDateCellProps {
  postDate: string | null;
  onDateChange: (date: string) => void;
  isSelected?: boolean;
}

export const PostDateCell: React.FC<PostDateCellProps> = ({
  postDate,
  onDateChange,
  isSelected = false
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const formatPostDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate) {
      onDateChange(newDate);
    }
    setIsEditing(false);
  };

  const handleClick = () => {
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="date"
          value={postDate || ''}
          onChange={handleDateChange}
          onBlur={() => setIsEditing(false)}
          autoFocus
          className={cn(
            'h-8 w-full rounded-[5px] border px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring',
            isSelected
              ? 'border-white bg-transparent text-white [color-scheme:dark]'
              : 'border-gray-300 bg-white'
          )}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={cn(
          'h-8 w-full justify-start rounded-[5px] px-3 text-xs',
          isSelected
            ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white [&_svg]:text-white'
            : ''
        )}
      >
        <CalendarIcon className="mr-2 h-3 w-3 flex-shrink-0" />
        <span className="truncate font-medium">
          {postDate ? formatPostDateForDisplay(postDate) : 'Select date'}
        </span>
      </Button>
    </div>
  );
};
