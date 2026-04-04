
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { CustomDatePicker as Calendar } from '@/shared/calendar/CustomDatePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format, addDays, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useEmployeeTargets } from '../hook/useEmployeeTargets';
import { CreateEmployeeTargetRequest, EmployeeTarget } from '../types/employee-targets';
import { toast } from 'sonner';

interface EditTargetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string;
  employeeName?: string;
  targetType: 'content_planning' | 'content_production' | 'content_posting';
  existingTarget?: EmployeeTarget;
}

const EditTargetDialog: React.FC<EditTargetDialogProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  targetType,
  existingTarget
}) => {
  const { createTarget, updateTarget, isCreating, isUpdating } = useEmployeeTargets();

  const [formData, setFormData] = useState<{
    target_category: EmployeeTarget['target_category'];
    start_date: string;
    end_date: string;
    target_value: number;
    description: string;
  }>({
    target_category: 'monthly',
    start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    target_value: 0,
    description: '',
  });

  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (existingTarget) {
        setFormData({
          target_category: existingTarget.target_category,
          start_date: existingTarget.start_date,
          end_date: existingTarget.end_date,
          target_value: existingTarget.target_value,
          description: existingTarget.description || '',
        });
      } else {
        // Reset to defaults for new target
        const today = new Date();
        setFormData({
          target_category: 'monthly',
          start_date: format(startOfMonth(today), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(today), 'yyyy-MM-dd'),
          target_value: 0,
          description: '',
        });
      }
    }
  }, [isOpen, existingTarget]);

  // Auto-adjust dates when category changes
  const handleCategoryChange = (category: EmployeeTarget['target_category']) => {
    const today = new Date();
    let startDate = today;
    let endDate = today;

    switch (category) {
      case 'daily':
        startDate = today;
        endDate = today;
        break;
      case 'weekly':
        startDate = today;
        endDate = addDays(today, 6);
        break;
      case 'monthly':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'quarterly':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        endDate = new Date(today.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
    }

    setFormData(prev => ({
      ...prev,
      target_category: category,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    }));
  };

  const handleSave = async () => {
    if (!employeeId) {
      toast.error('Employee ID is required');
      return;
    }

    if (formData.target_value <= 0) {
      toast.error('Target value must be greater than 0');
      return;
    }

    try {
      if (existingTarget) {
        // Update existing target
        await updateTarget({
          targetId: existingTarget.id,
          updates: {
            target_value: formData.target_value,
            description: formData.description,
          }
        });
        toast.success('Target updated successfully');
      } else {
        // Create new target
        const newTarget: CreateEmployeeTargetRequest = {
          employee_id: employeeId,
          target_type: targetType,
          target_category: formData.target_category,
          start_date: formData.start_date,
          end_date: formData.end_date,
          target_value: formData.target_value,
          description: formData.description,
        };

        await createTarget(newTarget);
        toast.success('Target created successfully');
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving target:', error);
      toast.error('Failed to save target');
    }
  };

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'content_planning':
        return 'Content Planning Target';
      case 'content_production':
        return 'Content Production Target';
      case 'content_posting':
        return 'Content Posting Target';
      default:
        return 'Target';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="flex h-[min(560px,95vh)] min-h-0 w-[520px] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden p-0"
        style={{ zIndex: 999999 }}
      >
        <DialogHeader className="flex-shrink-0 border-b border-primary/10 bg-gradient-to-r from-accent via-accent/90 to-accent/80 px-6 pb-4 pr-12 pt-6 dark:from-primary/15 dark:via-primary/10 dark:to-primary/10 sm:pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
              <Loader2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl font-semibold">
                {existingTarget ? 'Edit' : 'Create'} {getTargetTypeLabel()}
              </DialogTitle>
              {employeeName && (
                <p className="text-sm text-muted-foreground truncate">
                  Employee: {employeeName}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto overflow-x-hidden px-6 pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!existingTarget && (
            <div className="min-w-0 shrink-0 space-y-2">
              <Label htmlFor="category">Target Period</Label>
                <Select 
                value={formData.target_category} 
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="border-input focus:ring-ring data-[state=open]:border-primary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  style={{ zIndex: 999999 }}
                  position="popper"
                  sideOffset={4}
                >
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!existingTarget && (
            <>
              <div className="min-w-0 shrink-0 space-y-2">
                <Label>Start Date</Label>
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start border-input text-left font-normal hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium tabular-nums text-primary">
                        {format(new Date(formData.start_date), "dd MMM yyyy")}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" style={{ zIndex: 999999 }}>
                    <Calendar
                      selected={new Date(formData.start_date)}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(prev => ({ 
                            ...prev, 
                            start_date: format(date, 'yyyy-MM-dd') 
                          }));
                          setIsStartDateOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="min-w-0 shrink-0 space-y-2">
                <Label>End Date</Label>
                <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start border-input text-left font-normal hover:bg-accent hover:text-accent-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium tabular-nums text-primary">
                        {format(new Date(formData.end_date), "dd MMM yyyy")}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" style={{ zIndex: 999999 }}>
                    <Calendar
                      selected={new Date(formData.end_date)}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(prev => ({ 
                            ...prev, 
                            end_date: format(date, 'yyyy-MM-dd') 
                          }));
                          setIsEndDateOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          <div className="min-w-0 shrink-0 space-y-2">
            <Label htmlFor="target_value">Target Value</Label>
            <Input
              id="target_value"
              type="number"
              min="1"
              className="min-w-0 font-medium tabular-nums text-primary focus-visible:ring-ring"
              value={formData.target_value || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                target_value: parseInt(e.target.value) || 0 
              }))}
              placeholder="Enter target value"
            />
          </div>

          <div className="min-w-0 shrink-0 space-y-2 pb-1">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              className="min-h-[4.5rem] min-w-0 resize-y"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              placeholder="Add target description..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-muted/30 px-6 pb-6 pt-4">
          <Button variant="outline" onClick={onClose} className="w-full md:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isCreating || isUpdating}
            className="w-full md:w-auto"
          >
            {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existingTarget ? 'Update' : 'Create'} Target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTargetDialog;
