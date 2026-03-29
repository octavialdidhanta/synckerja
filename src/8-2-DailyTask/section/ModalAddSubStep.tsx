import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Plus, ListChecks } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

interface ModalAddSubStepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentStepId: string;
  parentStepTitle: string;
  onSuccess?: () => void;
}

export const ModalAddSubStep = ({
  open,
  onOpenChange,
  parentStepId,
  parentStepTitle,
  onSuccess
}: ModalAddSubStepProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !organizationId) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;

      const { error } = await supabase
        .from('task_steps_to_steps')
        .insert([
          {
            parent_step_id: parentStepId,
            title: title.trim(),
            organization_id: organizationId,
            created_by: userId,
          },
        ]);

      if (error) throw error;

      setTitle('');
      setDescription('');
      onSuccess?.();
      onOpenChange(false);
      toast({ title: 'Success', description: 'Step added successfully' });
    } catch (err) {
      console.error('Error adding sub-step:', err);
      toast({ title: 'Error', description: 'Failed to add step', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ListChecks className="h-5 w-5 text-blue-600" />
            <span>Add New Step</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-1">Parent Step:</p>
          <p className="text-sm text-blue-800 font-semibold">{parentStepTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="substep_title" className="text-sm font-medium">
              Step Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="substep_title"
              placeholder="e.g., Review document, Send email, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">Break down your step into smaller actions</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="substep_description" className="text-sm font-medium">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </Label>
            <Textarea
              id="substep_description"
              placeholder="Add more details about this step..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">💡 Tips for creating effective steps:</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Keep steps small and specific</li>
              <li>Use action verbs (e.g., "Review", "Send", "Create")</li>
              <li>Make each step completable in one sitting</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting} className="border-gray-300 hover:bg-gray-50">
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Step
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};








































































