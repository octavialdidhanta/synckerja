import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Calendar, Target, Clock, AlertCircle } from 'lucide-react';
// import { useCreateActivity } from '@/hooks/useActivities'; // TODO: File not found
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { supabase } from '@/shared/lib/supabaseClient';

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  objectiveId: string;
  objectiveTitle: string;
  employeeId: string;
}

export const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  objectiveId,
  objectiveTitle,
  employeeId,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    activity_type: 'task' as const,
    priority: 'medium' as const,
    start_date: '',
    due_date: '',
    estimated_hours: '',
  });
  
  const { data: currentEmployee } = useCurrentUserEmployee();
  const createActivityMutation = useCreateActivity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      return;
    }

    try {
      // Get the current user ID for RLS compliance
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      await createActivityMutation.mutateAsync({
        organization_id: organizationId,
        objective_id: objectiveId,
        individual_objective_id: objectiveId, // Use same value as objective_id
        employee_id: employeeId,
        title: formData.title,
        description: formData.description || undefined,
        activity_type: formData.activity_type,
        priority: formData.priority,
        start_date: formData.start_date || undefined,
        due_date: formData.due_date || undefined,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : undefined,
        assigned_by: user.id, // Use auth user ID for RLS compliance
        created_by: user.id,  // Use auth user ID for RLS compliance
      });
      
      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        activity_type: 'task',
        priority: 'medium',
        start_date: '',
        due_date: '',
        estimated_hours: '',
      });
      onClose();
    } catch (error) {
      console.error('Failed to create activity:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      activity_type: 'task',
      priority: 'medium',
      start_date: '',
      due_date: '',
      estimated_hours: '',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            Create New Activity
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm text-gray-600">
            <Target className="h-4 w-4" />
            For objective: {objectiveTitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Activity Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter activity title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the activity details..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          {/* Activity Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Activity Type</Label>
              <Select
                value={formData.activity_type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, activity_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      Low
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-brand-accent"></div>
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      High
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates and Hours */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-sm font-medium">
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-sm font-medium">
                Due Date
              </Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_hours" className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Est. Hours
              </Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
              />
            </div>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">Activity will help track progress towards your objective</p>
              <p>Break down your objective into manageable activities with clear deadlines.</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createActivityMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim() || createActivityMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createActivityMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Activity
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
