import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Plus, ListChecks } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';

export interface AddStepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  onAddStep: (taskId: string, title: string) => Promise<void>;
  onSuccess?: () => void;
}

export const AddStepModal = ({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  onAddStep,
  onSuccess
}: AddStepModalProps) => {
  const [stepTitle, setStepTitle] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stepTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a step title',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onAddStep(taskId, stepTitle.trim());

      // Reset form
      setStepTitle('');
      setStepDescription('');

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      // Error is already handled in onAddStep
      console.error('Error adding step:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setStepTitle('');
      setStepDescription('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Add Step to Task
          </DialogTitle>
          <DialogDescription>
            Add a new step to "{taskTitle}"
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="stepTitle">Step Title *</Label>
            <Input
              id="stepTitle"
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              placeholder="Enter step title"
              disabled={isSubmitting}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="stepDescription">Description (Optional)</Label>
            <Textarea
              id="stepDescription"
              value={stepDescription}
              onChange={(e) => setStepDescription(e.target.value)}
              placeholder="Enter step description"
              disabled={isSubmitting}
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !stepTitle.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Step'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
