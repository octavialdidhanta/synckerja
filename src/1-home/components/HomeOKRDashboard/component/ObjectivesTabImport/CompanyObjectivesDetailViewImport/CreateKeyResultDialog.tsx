import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useDepartments } from './useDepartments';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { getEmployeeStatus } from '@/2-1-employees/utils/employeeUtils';
import { toast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import type { Objective } from '@/types/okr';

interface CreateKeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective;
  onSuccess?: () => void;
}

export const CreateKeyResultDialog: React.FC<CreateKeyResultDialogProps> = ({
  open,
  onOpenChange,
  objective,
  onSuccess
}) => {
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { departments = [] } = useDepartments(organizationId);
  const { data: allEmployees = [] } = useEmployees();
  // TODO: Implement these hooks when available
  // const createKeyResult = useCreateKeyResult();
  // const createIndividualObjectiveMutation = useCreateIndividualObjective();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    metric_type: 'number' as const,
    calculation_type: 'increase' as 'increase' | 'decrease' | 'maintain',
    start_value: 0,
    target_value: 0,
    unit: '',
    weight: 100,
    is_inverse: false,
    department_id: '',
    responsible_employee_id: '',
    assigned_employee_id: ''
  });

  // Filter out terminated employees first
  const activeEmployees = React.useMemo(() => {
    return allEmployees.filter(employee => {
      const status = getEmployeeStatus(employee);
      return status.toLowerCase() !== 'terminated';
    });
  }, [allEmployees]);

  // Filter employees based on selected department or objective's department
  const getAvailableEmployees = () => {
    if (objective.level === 'department' && objective.department_id) {
      // For department objectives, show employees from that specific department
      return activeEmployees.filter(emp => emp.department_id === objective.department_id);
    }
    
    if (formData.department_id) {
      // For company objectives with selected department, show employees from selected department
      return activeEmployees.filter(emp => emp.department_id === formData.department_id);
    }
    
    // Default: show all active employees
    return activeEmployees;
  };

  const availableEmployees = getAvailableEmployees();

  // Auto-set calculation type and inverse based on target vs start value comparison
  useEffect(() => {
    if (formData.target_value > 0 && formData.start_value >= 0) {
      if (formData.target_value < formData.start_value) {
        // Target is less than start - set to decrease and enable inverse
        setFormData(prev => ({ 
          ...prev, 
          calculation_type: 'decrease' as const,
          is_inverse: true 
        }));
      } else if (formData.target_value > formData.start_value) {
        // Target is greater than start - set to increase and disable inverse
        setFormData(prev => ({ 
          ...prev, 
          calculation_type: 'increase' as const,
          is_inverse: false 
        }));
      }
    }
  }, [formData.target_value, formData.start_value]);

  // Simplified version - removed complex individual objective creation

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id || !organizationId) {
      toast({
        title: 'Error',
        description: 'User information not available',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    // Updated validation to handle inverse calculation
    if (!formData.is_inverse && formData.target_value <= formData.start_value) {
      toast({
        title: 'Error',
        description: 'Target value must be greater than start value for increase metrics',
        variant: 'destructive',
      });
      return;
    }

    if (formData.is_inverse && formData.target_value >= formData.start_value) {
      toast({
        title: 'Error',
        description: 'Target value must be less than start value for decrease metrics',
        variant: 'destructive',
      });
      return;
    }

    // Validation for department level objective - employee assignment is required
    if (objective.level === 'department' && !formData.assigned_employee_id) {
      toast({
        title: 'Error',
        description: 'Please select an employee to assign this department key result',
        variant: 'destructive',
      });
      return;
    }

    console.log('🚀 Creating Key Result with data:', {
      objective_id: objective.id,
      objective_level: objective.level,
      organization_id: organizationId,
      department_id: formData.department_id || null,
      responsible_employee_id: formData.responsible_employee_id || null,
      title: formData.title,
      user_id: user.id,
      is_inverse: formData.is_inverse
    });

    try {
      // Create the key result with assigned employee
      const keyResultData: any = {
        organization_id: organizationId,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        metric_type: formData.metric_type,
        calculation_type: formData.calculation_type,
        start_value: formData.start_value,
        target_value: formData.target_value,
        current_value: formData.start_value,
        unit: formData.unit?.trim() || null,
        weight: formData.weight,
        progress_percentage: 0,
        is_inverse: formData.is_inverse,
        created_by: user.id,
        owner_level: objective.level as 'company' | 'department' | 'individual',
        department_id: formData.department_id || null,
        created_by_department_id: formData.department_id || null,
        assigned_employee_id: formData.assigned_employee_id || null
      };

      // Set the correct objective reference based on objective level
      if (objective.level === 'company') {
        keyResultData.company_objective_id = objective.id;
      } else if (objective.level === 'department') {
        keyResultData.department_objective_id = objective.id;
      } else if (objective.level === 'individual') {
        keyResultData.individual_objective_id = objective.id;
      }

      console.log('📝 Final key result data:', keyResultData);

      // Insert key result directly using Supabase
      const { data: insertedKeyResult, error: insertError } = await supabase
        .from('key_results')
        .insert([keyResultData])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Supabase error:', insertError);
        throw new Error(insertError.message);
      }

      console.log('✅ Key result created successfully:', insertedKeyResult);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });

      toast({
        title: 'Success',
        description: 'Key Result created successfully!',
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        metric_type: 'number',
        calculation_type: 'increase',
        start_value: 0,
        target_value: 0,
        unit: '',
        weight: 100,
        is_inverse: false,
        department_id: '',
        responsible_employee_id: '',
        assigned_employee_id: ''
      });
      
      onOpenChange(false);
      onSuccess?.();
      
    } catch (error) {
      console.error('❌ Error creating key result:', error);
      toast({
        title: 'Error',
        description: 'Failed to create Key Result',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Key Result</DialogTitle>
          <p className="text-sm text-gray-600">
            For objective: <span className="font-medium">{objective.title}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter key result title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this key result"
              rows={3}
            />
          </div>


           {/* Assignment dropdown - Department for company objectives, Employee for department objectives */}
           {objective.level === 'company' && departments.length > 0 && (
             <div>
               <Label htmlFor="assigned_department">Assign to Department</Label>
               <Select
                 value={formData.department_id}
                 onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
               >
                 <SelectTrigger className="bg-white">
                   <SelectValue placeholder="Select department to assign this key result" />
                 </SelectTrigger>
                 <SelectContent className="bg-white z-50">
                   {departments.map((dept) => (
                     <SelectItem key={dept.id} value={dept.id}>
                       {dept.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <p className="text-xs text-gray-500 mt-1">
                 Assign this key result to a specific department for tracking
               </p>
             </div>
           )}

           {/* Employee assignment for department objectives */}
           {objective.level === 'department' && availableEmployees.length > 0 && (
             <div>
               <Label htmlFor="assigned_employee">Assign to Employee *</Label>
               <Select
                 value={formData.assigned_employee_id}
                 onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_employee_id: value }))}
               >
                 <SelectTrigger className="bg-white">
                   <SelectValue placeholder="Select employee to assign this key result" />
                 </SelectTrigger>
                 <SelectContent className="bg-white z-50">
                   {availableEmployees.map((employee) => (
                     <SelectItem key={employee.id} value={employee.id}>
                       {employee.full_name} ({employee.email})
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <p className="text-xs text-gray-500 mt-1">
                 Assign this key result to a specific employee for tracking
               </p>
             </div>
           )}

           {/* Responsible Employee Selection - Show for department level objectives or when department is selected */}
           {(objective.level === 'department' || formData.department_id) && availableEmployees.length > 0 && (
             <div>
               <Label htmlFor="responsible_employee">
                 Responsible Employee {objective.level === 'department' ? '*' : ''}
               </Label>
               <Select
                 value={formData.responsible_employee_id}
                 onValueChange={(value) => setFormData(prev => ({ ...prev, responsible_employee_id: value }))}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select responsible employee" />
                 </SelectTrigger>
                 <SelectContent>
                   {availableEmployees.map((employee) => (
                     <SelectItem key={employee.id} value={employee.id}>
                       {employee.full_name} ({employee.email})
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <p className="text-xs text-gray-500 mt-1">
                 {objective.level === 'department' 
                   ? 'Select an employee who will be responsible for this department key result'
                   : 'Select an employee from the chosen department'
                 }
               </p>
               {formData.responsible_employee_id && (
                 <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                   ✨ An Individual Objective will be automatically created for the selected employee
                 </div>
               )}
             </div>
           )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="metric_type">Metric Type</Label>
              <Select
                value={formData.metric_type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, metric_type: value }))}
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

            <div>
              <Label htmlFor="calculation_type">
                Calculation Type 
                {(formData.target_value !== formData.start_value && formData.target_value > 0) && (
                  <span className="text-xs text-blue-600 ml-1">(Auto-selected)</span>
                )}
              </Label>
              <Select
                value={formData.calculation_type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, calculation_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase</SelectItem>
                  <SelectItem value="decrease">Decrease</SelectItem>
                  <SelectItem value="maintain">Maintain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="start_value">Start Value</Label>
              <Input
                id="start_value"
                type="number"
                value={formData.start_value}
                onChange={(e) => setFormData(prev => ({ ...prev, start_value: Number(e.target.value) }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="target_value">Target Value</Label>
              <Input
                id="target_value"
                type="number"
                step="any"
                min="0"
                value={formData.target_value}
                onChange={(e) => setFormData(prev => ({ ...prev, target_value: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="e.g., %, $, units"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="weight">Weight (%)</Label>
            <Input
              id="weight"
              type="number"
              min="1"
              max="100"
              value={formData.weight}
              onChange={(e) => setFormData(prev => ({ ...prev, weight: Number(e.target.value) }))}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_inverse"
              checked={formData.is_inverse}
              onChange={(e) => setFormData(prev => ({ ...prev, is_inverse: e.target.checked }))}
            />
            <Label htmlFor="is_inverse">
              Inverse (lower is better) - {formData.is_inverse ? 'Automatically enabled' : 'Disabled'}
            </Label>
          </div>

          {formData.target_value < formData.start_value && formData.target_value > 0 && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              ℹ️ Calculation type automatically set to "Decrease" and inverse calculation enabled because target value is less than start value
            </div>
          )}

          {formData.target_value > formData.start_value && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
              ℹ️ Calculation type automatically set to "Increase" because target value is greater than start value
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim()}
            >
              {formData.responsible_employee_id ? 'Create Key Result & Individual Objective' : 'Create Key Result'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

