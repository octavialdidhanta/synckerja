import React, { useState, useMemo, useCallback } from 'react';
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
import { useCompanyObjectives } from '@/shared/hooks/useCompanyObjectives';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useToast } from '@/shared/components/ui/use-toast';
import { Building } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';

export interface ModalAddDepartmentContributionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  cycleId: string;
  cycleIds?: string[]; // Support for multiple cycle IDs (for filtered objectives)
  departmentId?: string;
  onSuccess?: () => void;
  editObjective?: any; // Add edit mode support
}

export const ModalAddDepartmentContribution = ({
  open,
  onOpenChange,
  organizationId,
  cycleId,
  cycleIds,
  departmentId,
  onSuccess,
  editObjective
}: ModalAddDepartmentContributionProps) => {
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useCurrentUser();

  // Initialize form data when editObjective changes
  React.useEffect(() => {
    const loadEditData = async () => {
      if (editObjective && open) {
        // First, set basic data from editObjective
        const initialData = {
          company_objective_id: editObjective.company_objective_id || '',
          title: editObjective.title || '',
          description: editObjective.description || '',
          why_important: editObjective.why_important || '',
          metric_type: 'number' as 'number' | 'percentage' | 'currency' | 'boolean',
          unit: '',
          start_value: '0',
          target_value: '100',
          weight: editObjective.weight?.toString() || '100'
        };

        // Fetch key_results data from Supabase for this department objective
        try {
          const { data: keyResults, error: krError } = await supabase
            .from('key_results')
            .select('target_value, start_value, unit, metric_type')
            .eq('department_objective_id', editObjective.id)
            .limit(1)
            .maybeSingle();

          if (!krError && keyResults) {
            // Use data from key_results if available
            initialData.target_value = keyResults.target_value?.toString() || '100';
            initialData.start_value = keyResults.start_value?.toString() || '0';
            initialData.unit = keyResults.unit || '';
            initialData.metric_type = (keyResults.metric_type as 'number' | 'percentage' | 'currency' | 'boolean') || 'number';
          } else {
            console.log('No key results found for department objective, using defaults');
          }
        } catch (error) {
          console.error('Error loading key results data:', error);
        }

        setFormData(initialData);
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

  // Get company objectives to show in dropdown
  // Priority: Use cycleIds from filter if provided and not empty, otherwise use cycleId, otherwise show all
  // This ensures company objectives match the active filter (e.g., Q1 2026)
  const activeCycleIds = React.useMemo(() => {
    // Check if cycleIds is provided and has valid IDs
    if (cycleIds && Array.isArray(cycleIds) && cycleIds.length > 0) {
      // Filter out empty strings and invalid IDs
      const validCycleIds = cycleIds.filter(id => id && id.trim() !== '');
      if (validCycleIds.length > 0) {
        return validCycleIds;
      }
    }
    // Fallback to cycleId if provided
    if (cycleId && cycleId.trim() !== '') {
      return [cycleId];
    }
    // If no valid cycle IDs, return undefined to fetch all company objectives
    return undefined;
  }, [cycleIds, cycleId]);
  
  // Fetch company objectives with filter
  const { data: filteredCompanyObjectives = [], isLoading: loadingFiltered, error: filteredError } = useCompanyObjectives(organizationId, activeCycleIds);
  
  // Fetch all company objectives as fallback (only if filtered results are empty)
  const { data: allCompanyObjectives = [], isLoading: loadingAll } = useCompanyObjectives(organizationId, undefined);
  
  // Use filtered objectives if available, otherwise fallback to all objectives
  // This ensures users can always select a company objective
  const companyObjectives = React.useMemo(() => {
    if (filteredCompanyObjectives.length > 0) {
      return filteredCompanyObjectives;
    }
    // If no filtered results and not loading, show all objectives as fallback
    if (!loadingFiltered && filteredCompanyObjectives.length === 0) {
      return allCompanyObjectives;
    }
    return filteredCompanyObjectives;
  }, [filteredCompanyObjectives, allCompanyObjectives, loadingFiltered]);
  
  const loadingObjectives = loadingFiltered || loadingAll;
  const objectivesError = filteredError;
  
  // Debug logging
  React.useEffect(() => {
    if (open) {
      console.log('🔍 ModalAddDepartmentContribution - Company Objectives Debug:', {
        organizationId,
        cycleId: cycleId || 'not provided',
        cycleIds: cycleIds || 'not provided',
        activeCycleIds,
        filteredCount: filteredCompanyObjectives.length,
        allCount: allCompanyObjectives.length,
        finalCount: companyObjectives.length,
        isLoading: loadingObjectives,
        error: objectivesError,
        filteredObjectives: filteredCompanyObjectives.map(obj => ({ id: obj.id, title: obj.title, cycle_id: obj.cycle_id })),
        allObjectives: allCompanyObjectives.map(obj => ({ id: obj.id, title: obj.title, cycle_id: obj.cycle_id })),
        finalObjectives: companyObjectives.map(obj => ({ id: obj.id, title: obj.title, cycle_id: obj.cycle_id })),
        // Check if target objective is in the list
        targetObjectiveFound: companyObjectives.some(obj => obj.id === '95cd16b9-fdfd-48e4-9998-440467fa8e76'),
        targetCycleId: '32531393-da93-405c-bf32-2f75c9f9941d',
        targetCycleInFilter: activeCycleIds?.includes('32531393-da93-405c-bf32-2f75c9f9941d'),
        usingFallback: filteredCompanyObjectives.length === 0 && allCompanyObjectives.length > 0
      });
    }
  }, [organizationId, cycleId, cycleIds, activeCycleIds, filteredCompanyObjectives, allCompanyObjectives, companyObjectives, loadingObjectives, objectivesError, open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_objective_id || !formData.title || !formData.why_important.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a company objective, enter a title, and explain why this is important',
        variant: 'destructive',
      });
      return;
    }

    if (!departmentId) {
      toast({
        title: 'Error',
        description: 'Department ID is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (editObjective) {
        // Update existing department objective
        const { data, error } = await (supabase as any)
          .from('department_objectives')
          .update({
            company_objective_id: formData.company_objective_id,
            title: formData.title,
            description: formData.description,
            why_important: formData.why_important,
            weight: parseFloat(formData.weight),
            updated_at: new Date().toISOString()
          })
          .eq('id', editObjective.id)
          .select()
          .single();

        if (error) throw error;

        // Also update the corresponding key result
        const { data: existingKeyResult } = await supabase
          .from('key_results')
          .select('id')
          .eq('department_objective_id', editObjective.id)
          .limit(1)
          .maybeSingle();

        if (existingKeyResult) {
          // Update existing key result
          const { error: krUpdateError } = await supabase
            .from('key_results')
            .update({
              title: formData.title,
              description: formData.description,
              metric_type: formData.metric_type || 'percentage',
              start_value: parseFloat(formData.start_value) || 0,
              target_value: parseFloat(formData.target_value) || 100,
              unit: formData.unit || '%',
              weight: parseFloat(formData.weight),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingKeyResult.id);

          if (krUpdateError) {
            console.error('Error updating key result:', krUpdateError);
            toast({
              title: 'Warning',
              description: 'Department objective updated but key result update failed',
              variant: 'destructive',
            });
          }
        } else {
          // Create new key result if it doesn't exist
          const { error: krCreateError } = await supabase
            .from('key_results')
            .insert({
              organization_id: organizationId,
              department_objective_id: editObjective.id,
              title: formData.title,
              description: formData.description,
              metric_type: formData.metric_type || 'percentage',
              calculation_type: 'increase',
              start_value: parseFloat(formData.start_value) || 0,
              target_value: parseFloat(formData.target_value) || 100,
              unit: formData.unit || '%',
              current_value: 0,
              weight: parseFloat(formData.weight),
              created_by: currentUser?.id || '',
              owner_level: 'department'
            });

          if (krCreateError) {
            console.error('Error creating key result:', krCreateError);
            toast({
              title: 'Warning',
              description: 'Department objective updated but key result creation failed',
              variant: 'destructive',
            });
          }
        }

        toast({
          title: 'Success',
          description: 'Department contribution updated successfully',
        });
      } else {
        // Create new department objective
        const { data: deptObjective, error: deptError } = await (supabase as any)
          .from('department_objectives')
          .insert({
            organization_id: organizationId,
            cycle_id: cycleId,
            department_id: departmentId,
            company_objective_id: formData.company_objective_id,
            title: formData.title,
            description: formData.description,
            why_important: formData.why_important,
            weight: parseFloat(formData.weight),
            status: 'active',
            owner_id: currentUser?.id || '',
            created_by: currentUser?.id || '',
            progress_percentage: 0
          })
          .select()
          .single();

        if (deptError) throw deptError;

        // Create corresponding key result for the department objective
        const { data: keyResultData, error: keyResultError } = await (supabase as any)
          .from('key_results')
          .insert({
            organization_id: organizationId,
            department_objective_id: deptObjective.id,
            title: formData.title,
            description: formData.description,
            metric_type: formData.metric_type || 'percentage',
            calculation_type: 'increase', // Required field - valid values: increase, decrease, maintain
            start_value: parseFloat(formData.start_value) || 0,
            target_value: parseFloat(formData.target_value) || 100,
            unit: formData.unit || '%',
            current_value: 0,
            weight: parseFloat(formData.weight),
            created_by: currentUser?.id || '',
            owner_level: 'department'
          })
          .select()
          .single();

        if (keyResultError) {
          console.error('Error creating key result:', keyResultError);
          toast({
            title: 'Warning',
            description: 'Department objective created but key result creation failed. Please check the logs.',
            variant: 'destructive',
          });
        } else {
          console.log('✅ Key result created successfully:', keyResultData);
        }

        toast({
          title: 'Success',
          description: 'Department contribution created successfully',
        });
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
    } catch (error) {
      console.error('Error saving department contribution:', error);
      toast({
        title: 'Error',
        description: editObjective ? 'Failed to update department contribution' : 'Failed to create department contribution',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, departmentId, organizationId, cycleId, editObjective, currentUser, toast, onSuccess, onOpenChange]);

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

  // Memoize form handlers to prevent unnecessary re-renders
  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Memoize company objectives options
  const companyObjectiveOptions = useMemo(() => {
    if (loadingObjectives) {
      return [{ value: 'loading', label: 'Loading company objectives...', disabled: true }];
    }
    if (objectivesError) {
      return [{ value: 'error', label: 'Error loading objectives', disabled: true }];
    }
    if (companyObjectives.length === 0) {
      return [{ value: 'no-objectives', label: 'No company objectives found. Please create a company objective first.', disabled: true }];
    }
    return companyObjectives.map((objective) => ({
      value: objective.id,
      label: objective.title
    }));
  }, [companyObjectives, loadingObjectives, objectivesError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-none">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 pb-4 pt-6 pr-12">
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5 text-primary" />
            <span>{editObjective ? 'Edit Department Contribution' : 'Create Department Contribution'}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Hubungkan kontribusi departemen dengan objective perusahaan dan tetapkan metrik pencapaiannya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogFormScrollArea className="space-y-4 px-6 py-4">
          {/* Company Objective Selection */}
          <div className="space-y-2">
            <Label htmlFor="company_objective" className="text-sm font-medium">
              Company Objective <span className="text-brand-accent">*</span>
            </Label>
            {companyObjectives.length === 0 && !loadingObjectives && (
              <p className="rounded bg-warning-muted p-2 text-xs text-warning-foreground">
                💡 No company objectives available. Please create a company objective first in the Company Objective tab.
              </p>
            )}
            <Select
              value={formData.company_objective_id}
              onValueChange={(value) => handleSelectChange('company_objective_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company objective" />
              </SelectTrigger>
              <SelectContent>
                {companyObjectiveOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Objective Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Department Objective Title <span className="text-brand-accent">*</span>
            </Label>
            <Input
              id="title"
              placeholder="What is your department contribution objective?"
              value={formData.title}
              onChange={(e) => handleFormChange('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the department objective in detail"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Why Important */}
          <div className="space-y-2">
            <Label htmlFor="why_important" className="text-sm font-medium">
              Why this is important <span className="text-brand-accent">*</span>
            </Label>
            <Textarea
              id="why_important"
              placeholder="Explain why this objective is important and its impact"
              value={formData.why_important}
              onChange={(e) => handleFormChange('why_important', e.target.value)}
              rows={3}
              required
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
                  handleSelectChange('metric_type', value)
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
                onChange={(e) => handleFormChange('unit', e.target.value)}
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
                onChange={(e) => handleFormChange('start_value', e.target.value)}
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
                onChange={(e) => handleFormChange('target_value', e.target.value)}
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
              onChange={(e) => handleFormChange('weight', e.target.value)}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? (editObjective ? 'Updating...' : 'Creating...') : (editObjective ? 'Update Department Contribution' : 'Create Department Contribution')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


