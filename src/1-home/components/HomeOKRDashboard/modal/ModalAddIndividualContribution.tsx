import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useCreateIndividualObjective, useUpdateIndividualObjective } from './useIndividualObjectives';
import { useDepartmentObjectives } from './useDepartmentObjectives';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useToast } from '@/shared/components/ui/use-toast';
import { Target } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { KEY_RESULT_SELECT_COLUMNS, pickKeyResultDbWrite } from '@/1-home/components/HomeOKRDashboard/lib/keyResultDb';
import { whyImportantFromRow } from '@/1-home/components/HomeOKRDashboard/lib/objectiveDb';

export interface ModalAddIndividualContributionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  cycleId?: string;
  cycleIds?: string[];
  departmentId?: string;
  employeeId?: string;
  employeeName?: string;
  onSuccess?: () => void;
  editObjective?: any; // Add edit mode support
}

export const ModalAddIndividualContribution = ({
  open,
  onOpenChange,
  organizationId,
  cycleId,
  cycleIds,
  departmentId,
  employeeId,
  employeeName,
  onSuccess,
  editObjective
}: ModalAddIndividualContributionProps) => {
  const [formData, setFormData] = useState({
    company_objective_id: '',
    title: '',
    description: '',
    why_important: '',
    metric_type: 'number' as 'number' | 'percentage' | 'currency' | 'boolean',
    unit: '',
    start_value: '0',
    target_value: '100',
    weight: '100'
  });

  const { toast } = useToast();
  const { user: currentUser } = useCurrentUser();
  const { data: currentEmployee } = useCurrentEmployee();
  // TODO: File not found - const { data: employees = [] } = useEmployees();
  const createObjective = useCreateIndividualObjective();
  const updateObjective = useUpdateIndividualObjective();

  // Initialize form data when editObjective changes
  React.useEffect(() => {
    const loadEditData = async () => {
      if (editObjective && open && editObjective.id) {
        // Fetch key result data from database
        try {
          const { data: keyResultData, error: keyResultError } = await supabase
            .from('key_results')
            .select('unit, target_value, current_value, metric_type')
            .eq('individual_objective_id', editObjective.id)
            .maybeSingle();

          if (keyResultError) {
            console.error('Error fetching key result:', keyResultError);
          }

          // Use real data from key result if available, otherwise use defaults
          setFormData({
            company_objective_id: editObjective.department_objective_id || '',
            title: editObjective.title || '',
            description: editObjective.description || '',
            why_important: whyImportantFromRow(editObjective),
            metric_type: (keyResultData?.metric_type as 'number' | 'percentage' | 'currency' | 'boolean') || 'number',
            unit: keyResultData?.unit || '',
            start_value: keyResultData?.current_value?.toString() || '0',
            target_value: keyResultData?.target_value?.toString() || '100',
            weight: editObjective.weight?.toString() || '100'
          });
        } catch (error) {
          console.error('Error loading edit data:', error);
          // Fallback to basic data if fetch fails
          setFormData({
            company_objective_id: editObjective.department_objective_id || '',
            title: editObjective.title || '',
            description: editObjective.description || '',
            why_important: whyImportantFromRow(editObjective),
            metric_type: 'number',
            unit: '',
            start_value: '0',
            target_value: '100',
            weight: editObjective.weight?.toString() || '100'
          });
        }
      } else if (!editObjective && open) {
        // Reset form for new objective
        setFormData({
          company_objective_id: '',
          title: '',
          description: '',
          why_important: '',
          metric_type: 'number',
          unit: '',
          start_value: '0',
          target_value: '100',
          weight: '100'
        });
      }
    };

    loadEditData();
  }, [editObjective, open]);

  const resolvedCycleIds = useMemo(
    () => (cycleIds && cycleIds.length > 0 ? cycleIds : cycleId ? [cycleId] : undefined),
    [cycleIds, cycleId],
  );

  const {
    data: allDepartmentObjectives = [],
    isLoading: loadingObjectives,
    error: objectivesError,
  } = useDepartmentObjectives(organizationId, resolvedCycleIds, false);

  const departmentObjectives = useMemo(() => {
    const activeOnly = allDepartmentObjectives.filter(
      (obj: { status?: string }) => obj.status === 'active',
    );
    return departmentId
      ? activeOnly.filter((obj: { department_id?: string }) => obj.department_id === departmentId)
      : activeOnly;
  }, [departmentId, allDepartmentObjectives]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentEmployee) {
      toast({
        title: 'Error',
        description: 'Employee information not found. Please ensure you are logged in properly.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.company_objective_id || !formData.title) {
      toast({
        title: 'Error',
        description: 'Please select a department objective and enter a title',
        variant: 'destructive',
      });
      return;
    }

    const selectedDeptObjective = departmentObjectives.find(
      (obj: { id: string }) => obj.id === formData.company_objective_id,
    );

    const objectiveCycleId = selectedDeptObjective?.cycle_id as string | undefined;
    if (!objectiveCycleId) {
      toast({
        title: 'Error',
        description: 'No OKR cycle selected. Please select a time period and try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editObjective && editObjective.id) {
        await updateObjective.mutateAsync({
          id: editObjective.id,
          updates: {
            department_objective_id: formData.company_objective_id,
            title: formData.title,
            description: formData.description,
            why_important: formData.why_important,
            weight: parseFloat(formData.weight),
          }
        });

        // Update corresponding key result for the individual objective (edit mode)
        try {
          // First, find the existing key result
          const { data: existingKeyResult, error: findError } = await supabase
            .from('key_results')
            .select('id')
            .eq('individual_objective_id', editObjective.id)
            .maybeSingle();

          if (findError) {
            console.error('Error finding key result:', findError);
          }

          if (existingKeyResult) {
            // Update existing key result
            const { error: updateKeyResultError } = await supabase
              .from('key_results')
              .update(
                pickKeyResultDbWrite({
                  title: formData.title,
                  metric_type: formData.metric_type || 'number',
                  current_value: parseFloat(formData.start_value) || 0,
                  target_value: parseFloat(formData.target_value) || 100,
                  unit: formData.unit || '',
                  weight: parseFloat(formData.weight),
                }),
              )
              .eq('id', existingKeyResult.id);

            if (updateKeyResultError) {
              console.error('Error updating key result:', updateKeyResultError);
              toast({
                title: 'Warning',
                description: 'Individual objective updated but key result update failed. Please check the logs.',
                variant: 'destructive',
              });
            } else {
              console.log('✅ Key result updated successfully');
            }
          } else {
            // Create key result if it doesn't exist
            const { error: createKeyResultError } = await supabase
              .from('key_results')
              .insert(
                pickKeyResultDbWrite({
                  individual_objective_id: editObjective.id,
                  title: formData.title,
                  metric_type: formData.metric_type || 'number',
                  target_value: parseFloat(formData.target_value) || 100,
                  unit: formData.unit || '',
                  current_value: parseFloat(formData.start_value) || 0,
                  progress_percentage: 0,
                  weight: parseFloat(formData.weight),
                }),
              );

            if (createKeyResultError) {
              console.error('Error creating key result:', createKeyResultError);
              toast({
                title: 'Warning',
                description: 'Individual objective updated but key result creation failed. Please check the logs.',
                variant: 'destructive',
              });
            } else {
              console.log('✅ Key result created successfully');
            }
          }
        } catch (keyResultError) {
          console.error('Error updating key result:', keyResultError);
          toast({
            title: 'Warning',
            description: 'Individual objective updated but key result update failed. Please check the logs.',
            variant: 'destructive',
          });
        }
      } else {
        const individualObjective = await createObjective.mutateAsync({
          organization_id: organizationId,
          cycle_id: objectiveCycleId,
          employee_id: (currentEmployee as any).id,
          owner_id: currentUser?.id || '',
          department_objective_id: formData.company_objective_id,
          title: formData.title,
          description: formData.description,
          why_important: formData.why_important,
          weight: parseFloat(formData.weight),
          status: 'active',
          created_by: currentUser?.id || '',
        });

        // Create corresponding key result for the individual objective (create mode only)
        if (individualObjective && (individualObjective as any).id) {
          try {
            const { data: keyResultData, error: keyResultError } = await supabase
              .from('key_results')
              .insert(
                pickKeyResultDbWrite({
                  individual_objective_id: (individualObjective as any).id,
                  title: formData.title,
                  metric_type: formData.metric_type || 'percentage',
                  target_value: parseFloat(formData.target_value) || 100,
                  unit: formData.unit || '%',
                  current_value: parseFloat(formData.start_value) || 0,
                  progress_percentage: 0,
                  weight: parseFloat(formData.weight),
                }),
              )
              .select(KEY_RESULT_SELECT_COLUMNS)
              .single();

            if (keyResultError) {
              console.error('Error creating key result:', keyResultError);
              toast({
                title: 'Warning',
                description: 'Individual objective created but key result creation failed. Please check the logs.',
                variant: 'destructive',
              });
            } else {
              console.log('✅ Key result created successfully:', keyResultData);
            }
          } catch (keyResultError) {
            console.error('Error creating key result:', keyResultError);
            toast({
              title: 'Warning',
              description: 'Individual objective created but key result creation failed. Please check the logs.',
              variant: 'destructive',
            });
          }
        }
      }

      // Reset form
      setFormData({
        company_objective_id: '',
        title: '',
        description: '',
        why_important: '',
        metric_type: 'number',
        unit: '',
        start_value: '0',
        target_value: '100',
        weight: '100'
      });

      onSuccess?.();
      onOpenChange(false);

      toast({
        title: 'Success',
        description: editObjective ? 'Individual contribution updated successfully' : 'Individual contribution created successfully',
      });
    } catch (error) {
      console.error('Error creating individual contribution:', error);
      toast({
        title: 'Error',
        description: 'Failed to create individual contribution',
        variant: 'destructive',
      });
    }
  }, [currentEmployee, formData, departmentObjectives, createObjective, updateObjective, editObjective, currentUser, organizationId, toast, onSuccess, onOpenChange]);

  const handleCancel = useCallback(() => {
    // Reset form
    setFormData({
      company_objective_id: '',
      title: '',
      description: '',
      why_important: '',
      metric_type: 'number',
      unit: '',
      start_value: '0',
      target_value: '100',
      weight: '100'
    });
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-none">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 pb-4 pt-6 pr-12">
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>{editObjective ? 'Edit Individual Contribution' : 'Create Individual Contribution'}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Hubungkan kontribusi individu dengan tujuan departemen dan tetapkan target yang terukur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogFormScrollArea className="space-y-4 px-6 py-4">
          {/* Department Objective Selection */}
          <div className="space-y-2">
            <Label htmlFor="company_objective" className="text-sm font-medium">
              Department Objective <span className="text-brand-accent">*</span>
            </Label>
            {departmentObjectives.length === 0 && !loadingObjectives && (
              <p className="rounded bg-warning-muted p-2 text-xs text-warning-foreground">
                💡 No department objectives available. Please create a department objective first in the Department Objective tab.
              </p>
            )}
            <Select
              value={formData.company_objective_id}
              onValueChange={(value) => setFormData({ ...formData, company_objective_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a department objective" />
              </SelectTrigger>
              <SelectContent>
                {loadingObjectives ? (
                  <SelectItem value="loading" disabled>
                    Loading department objectives...
                  </SelectItem>
                ) : objectivesError ? (
                  <SelectItem value="error" disabled>
                    Error loading objectives
                  </SelectItem>
                ) : departmentObjectives.length > 0 ? (
                  departmentObjectives.map((objective: any) => (
                    <SelectItem key={objective.id} value={objective.id}>
                      {objective.title}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-objectives" disabled>
                    No department objectives found. Please create a department objective first.
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Individual Objective Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Individual Objective Title <span className="text-brand-accent">*</span>
            </Label>
            <Input
              id="title"
              placeholder="What is your individual contribution objective?"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the individual objective in detail"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Why Important */}
          <div className="space-y-2">
            <Label htmlFor="why_important" className="text-sm font-medium">
              Why this is important
            </Label>
            <Textarea
              id="why_important"
              placeholder="Explain why this objective is important and its impact"
              value={formData.why_important}
              onChange={(e) => setFormData({ ...formData, why_important: e.target.value })}
              rows={3}
            />
          </div>

          {/* Metric Type and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metric_type" className="text-sm font-medium">
                Metric Type
              </Label>
              <Select
                value={formData.metric_type}
                onValueChange={(value: 'number' | 'percentage' | 'currency' | 'boolean') => 
                  setFormData({ ...formData, metric_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit" className="text-sm font-medium">
                Unit
              </Label>
              <Input
                id="unit"
                placeholder="e.g., campaigns, designs, videos"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
          </div>

          {/* Start Value and Target Value */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_value" className="text-sm font-medium">
                Start Value
              </Label>
              <Input
                id="start_value"
                type="number"
                value={formData.start_value}
                onChange={(e) => setFormData({ ...formData, start_value: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_value" className="text-sm font-medium">
                Target Value <span className="text-brand-accent">*</span>
              </Label>
              <Input
                id="target_value"
                type="number"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
              />
            </div>
          </div>

          {/* Weight (Impact) */}
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium">
              Weight (Impact) <span className="text-brand-accent">*</span>
            </Label>
            <Input
              id="weight"
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
          </div>
          </DialogFormScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createObjective.isPending}
            >
              {createObjective.isPending ? (editObjective ? 'Updating...' : 'Creating...') : (editObjective ? 'Update Individual Contribution' : 'Create Individual Contribution')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};




