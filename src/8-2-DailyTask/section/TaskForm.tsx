import React, { useState, useEffect } from 'react';
import { Plus, Flag, User, Target, UserPlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useDailyTask } from '../context/DailyTaskContext';
import { AssignTaskModal } from './AssignTaskModal';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useIndividualObjectives } from '@/1-home/components/HomeOKRDashboard/modal/useIndividualObjectives';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { ObjectiveHierarchyDialog } from '@/8-2-DailyTask/section/ObjectiveHierarchyDialog';
import './TaskForm.css';

export const TaskForm = () => {
  const { addTask } = useDailyTask();
  const { data: employees = [] } = useAvailableEmployees();
  const { data: currentEmployee } = useCurrentEmployee();
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);
  
  // Get active cycle IDs for current period
  // Also include cycles from current year and next year to show all relevant objectives
  const currentYear = new Date().getFullYear();
  const activeCycleIds = cycles
    .filter(cycle => {
      const cycleYear = (cycle as any).year;
      // Include active cycles OR cycles from current year and next year
      return (cycle as any).is_active === true || 
             (cycleYear === currentYear || cycleYear === currentYear + 1);
    })
    .map(cycle => cycle.id);
    
  const { data: individualObjectives = [] } = useIndividualObjectives(organizationId, activeCycleIds);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [objectiveId, setObjectiveId] = useState<string>('');
  const [objectiveContext, setObjectiveContext] = useState<{
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  
  // Assignment state - will be set via modal
  const [assignment, setAssignment] = useState<{
    employeeId: string | null;
    deadline: string | null;
  }>({
    employeeId: null,
    deadline: null
  });
  const [showAssignModal, setShowAssignModal] = useState(false);

  const handleAssign = (newAssignment: { employeeId: string | null; deadline: string | null }) => {
    setAssignment(newAssignment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    // Validate that Individual Objective is selected
    if (!objectiveId) {
      alert('Please select an Individual Objective before creating the task.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTask({
        title: title.trim(),
        description: description.trim(),
        priority: priority as 'low' | 'medium' | 'high' | 'urgent' | 'needs_to_be_presented',
        due_date: assignment.deadline || null,
        assigned_to: assignment.employeeId || null,
        objective_id: objectiveId,
        status: 'pending'
      } as any);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setObjectiveId('');
      setObjectiveContext(null);
      setAssignment({ employeeId: null, deadline: null });
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-4">
        {/* Task Title */}
        <div className="flex-1">
          <Input
            id="task-form-title"
            name="title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          />
        </div>

        {/* Priority Selector */}
        <div className="w-32">
          <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
            <SelectTrigger className="border border-gray-200 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-green-600" />
                  Low
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-blue-600" />
                  Medium
                </div>
              </SelectItem>
              <SelectItem value="high">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-orange-600" />
                  High
                </div>
              </SelectItem>
              <SelectItem value="urgent">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-600" />
                  Urgent
                </div>
              </SelectItem>
              <SelectItem value="needs_to_be_presented">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-purple-600" />
                  Presentation
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Individual Objective */}
        <div className="w-64 min-w-0 overflow-hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsObjectiveDialogOpen(true)}
            disabled={isSubmitting}
            className="w-full min-w-0 justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10 overflow-hidden"
          >
            {objectiveId && objectiveContext ? (
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <Target className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex flex-col min-w-0 flex-1 text-left overflow-hidden">
                  <span className="text-sm truncate font-medium text-gray-900 block">
                    {objectiveContext.individualTitle}
                  </span>
                  {(objectiveContext.companyTitle || objectiveContext.departmentTitle) && (
                    <span className="text-xs text-gray-500 truncate block">
                      {objectiveContext.companyTitle && objectiveContext.departmentTitle
                        ? `${objectiveContext.companyTitle} â†’ ${objectiveContext.departmentTitle}`
                        : objectiveContext.companyTitle || objectiveContext.departmentTitle}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
                <Target className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-500 text-sm truncate text-left block min-w-0">Select Individual Objective</span>
              </div>
            )}
          </Button>
        </div>

        {/* Assign Button */}
        <div className="w-48">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAssignModal(true)}
            disabled={isSubmitting}
            className="w-full justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10"
          >
            {assignment.employeeId ? (
              <div className="flex items-center gap-2 w-full">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm truncate flex-1 text-left">
                  {employees.find(e => e.id === assignment.employeeId)?.full_name || 'Assigned'}
                </span>
                {assignment.deadline && (
                  <span className="text-xs text-gray-500">
                    {new Date(assignment.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500 text-sm">Assign</span>
              </div>
            )}
          </Button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!title.trim() || !objectiveId || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Adding...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Task
            </div>
          )}
        </Button>
      </div>

      {/* Description (Optional) */}
      {title && (
        <div className="mt-3">
          <Textarea
            id="task-form-description"
            name="description"
            placeholder="Add description (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        </div>
      )}
      </form>

      {/* Assign Task Modal */}
      <AssignTaskModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        onAssign={handleAssign}
        currentAssignment={assignment}
      />

      {/* Lazy-load so Company/Department objectives aren't fetched until user opens picker */}
      {isObjectiveDialogOpen && (
        <ObjectiveHierarchyDialog
          open={isObjectiveDialogOpen}
          onOpenChange={setIsObjectiveDialogOpen}
          onSelect={(id, context) => {
            setObjectiveId(id);
            setObjectiveContext(context);
          }}
          selectedObjectiveId={objectiveId}
          organizationId={organizationId || ''}
          cycleIds={activeCycleIds}
        />
      )}
    </>
  );
};






