import React, { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface DueDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dueDate: string) => void;
  taskTitle: string;
  taskType: 'task' | 'step' | 'substep';
  isLoading?: boolean;
}

export const DueDateDialog: React.FC<DueDateDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
  taskType,
  isLoading = false
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('23:59');

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      // Set default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
      setSelectedTime('23:59');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedDate) return;

    // Combine date and time
    const dueDateString = `${selectedDate}T${selectedTime}:00`;
    const dueDate = new Date(dueDateString);
    
    onConfirm(dueDate.toISOString());
  };

  const getTaskTypeLabel = () => {
    switch (taskType) {
      case 'task':
        return 'Task';
      case 'step':
        return 'Step';
      case 'substep':
        return 'Sub-Step';
      default:
        return 'Item';
    }
  };

  const isValidDate = selectedDate && new Date(selectedDate) >= new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Set Due Date
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Title Display */}
          <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
            <div className="text-xs font-medium text-gray-500 mb-1">
              {getTaskTypeLabel()}
            </div>
            <div className="text-sm font-medium text-gray-900 line-clamp-2">
              {taskTitle}
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="due-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Due Date
            </Label>
            <Input
              id="due-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full focus-visible:border-primary focus-visible:ring-primary"
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="due-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Due Time
            </Label>
            <Input
              id="due-time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full focus-visible:border-primary focus-visible:ring-primary"
            />
          </div>

          {/* Preview */}
          {selectedDate && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 text-xs font-medium text-primary">
                Deadline Preview
              </div>
              <div className="text-sm font-semibold text-foreground">
                {new Date(`${selectedDate}T${selectedTime}`).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValidDate || isLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <span className="mr-2">⏳</span>
                Taking Task...
              </>
            ) : (
              <>
                <span className="mr-2">✓</span>
                Confirm & Take Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};





