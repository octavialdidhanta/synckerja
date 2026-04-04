import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { RotateCcw, X } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import './ApprovalAccessModal.css';
interface ApprovalAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (success: boolean) => void;
  editData?: any;
}
interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

export const ApprovalAccessModal = ({
  isOpen,
  onClose,
  onSave,
  editData
}: ApprovalAccessModalProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    columnType: '',
    columnName: '',
    allowedRoles: {
      owner: true,
      admin: false,
      employee: false
    },
    exceptions: [] as string[],
    exceptionPaths: [] as string[]
  });
  // Fetch user's organization and employees on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user's organization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('User not authenticated');
          return;
        }

        // Get user's active organization
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          toast.error('Failed to fetch user profile');
          return;
        }

        if (!profile?.active_organization_id) {
          toast.error('No active organization found');
          return;
        }

        setOrganizationId(profile.active_organization_id);

        // Fetch employees from the same organization
        const { data: employeesData, error: employeesError } = await supabase
          .from('employees')
          .select('id, full_name, employee_id')
          .eq('organization_id', profile.active_organization_id)
          .order('full_name');
        
        if (employeesError) {
          console.error('Error fetching employees:', employeesError);
          toast.error('Failed to fetch employees');
          return;
        }
        
        setEmployees(employeesData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch data');
      }
    };

    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  // Separate useEffect to handle edit data population
  useEffect(() => {
    if (isOpen && editData && employees.length > 0) {
      console.log('🔧 Edit mode: Populating form with data:', editData);
      console.log('🔧 Available employees:', employees.length);
      
      // Populate form with edit data
      setFormData({
        columnType: editData.columnType || '',
        columnName: editData.columnName || '',
        allowedRoles: {
          owner: editData.allowedRoles?.includes('owner') ?? true,
          admin: editData.allowedRoles?.includes('admin') ?? false,
          employee: editData.allowedRoles?.includes('employee') ?? false
        },
        exceptions: editData.exceptions || [],
        exceptionPaths: []
      });
      
      // Set selected employees based on exceptions
      if (editData.exceptions?.length > 0) {
        const exceptionEmployees = employees.filter(emp => 
          editData.exceptions.includes(emp.id)
        );
        console.log('🔧 Found exception employees:', exceptionEmployees);
        setSelectedEmployees(exceptionEmployees);
      } else {
        setSelectedEmployees([]);
      }
    } else if (isOpen && !editData) {
      // Reset form for new entry
      setFormData({
        columnType: '',
        columnName: '',
        allowedRoles: {
          owner: true,
          admin: false,
          employee: false
        },
        exceptions: [],
        exceptionPaths: []
      });
      setSelectedEmployees([]);
    }
  }, [isOpen, editData, employees]);

  const handleRoleToggle = (role: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      allowedRoles: {
        ...prev.allowedRoles,
        [role]: checked
      }
    }));
  };

  const handleEmployeeSelect = (employee: Employee) => {
    const isAlreadySelected = selectedEmployees.some(emp => emp.id === employee.id);
    
    if (isAlreadySelected) {
      setSelectedEmployees(prev => prev.filter(emp => emp.id !== employee.id));
    } else {
      setSelectedEmployees(prev => [...prev, employee]);
    }
  };

  const handleRemoveEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => prev.filter(emp => emp.id !== employeeId));
  };
  const handleSave = async () => {
    if (!organizationId) {
      toast.error('Organization not found');
      return;
    }

    if (!formData.columnType || !formData.columnName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const allowedRolesArray = Object.entries(formData.allowedRoles)
        .filter(([_, allowed]) => allowed)
        .map(([role, _]) => role);
      
      const selectedEmployeeIds = selectedEmployees.map(emp => emp.id);
      
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();

      let data, error;

      if (editData?.id) {
        // Update existing configuration
        const { data: updateData, error: updateError } = await supabase
          .from('approval_access_configurations')
          .update({
            column_type: formData.columnType,
            column_name: formData.columnName,
            allowed_roles: allowedRolesArray,
            exceptions: selectedEmployeeIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', editData.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Create new configuration
        const { data: insertData, error: insertError } = await supabase
          .from('approval_access_configurations')
          .insert({
            organization_id: organizationId,
            column_type: formData.columnType,
            column_name: formData.columnName,
            allowed_roles: allowedRolesArray,
            exceptions: selectedEmployeeIds,
            created_by: user?.id,
            is_active: true
          })
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      }

      if (error) {
        console.error('Error saving configuration:', error);
        toast.error('Failed to save configuration: ' + error.message);
        onSave(false);
        return;
      }

      toast.success(`Configuration ${editData ? 'updated' : 'created'} successfully!`);
      
      // Reset form
      setFormData({
        columnType: '',
        columnName: '',
        allowedRoles: {
          owner: true,
          admin: false,
          employee: false
        },
        exceptions: [],
        exceptionPaths: []
      });
      setSelectedEmployees([]);
      
      onSave(true);
      onClose();
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
      onSave(false);
    } finally {
      setIsLoading(false);
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md approval-access-modal" style={{ zIndex: 999999 }}>
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit' : 'Create New'} Approval Access</DialogTitle>
          <DialogDescription>
            Configure approval permissions for specific columns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Column Type */}
          <div className="space-y-2">
            <Label htmlFor="columnType" className="text-sm font-medium">
              Column Type <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.columnType} onValueChange={value => {
            setFormData(prev => ({
              ...prev,
              columnType: value,
              columnName: value === 'approved' ? 'Approved' : 
                         value === 'prod_approved' ? 'Prod Approved' : 
                         value === 'done' ? 'Done' : 
                         value === 'revision' ? 'Revision' :
                         value === 'production_revision' ? 'Prod Revision' : ''
            }));
          }}>
              <SelectTrigger>
                <SelectValue placeholder="Select column type" />
              </SelectTrigger>
              <SelectContent 
                style={{ zIndex: 999999 }}
                position="popper"
                sideOffset={4}
              >
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="prod_approved">Prod Approved</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="revision">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Revision
                  </div>
                </SelectItem>
                <SelectItem value="production_revision">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Prod Revision
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Name */}
          <div className="space-y-2">
            <Label htmlFor="columnName" className="text-sm font-medium">
              Column Title <span className="text-destructive">*</span>
            </Label>
            <Input id="columnName" value={formData.columnName} onChange={e => setFormData(prev => ({
            ...prev,
            columnName: e.target.value
          }))} placeholder="Column display name" />
          </div>

          {/* Allowed Roles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allowed Roles</Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Owner (Always Has Access)</span>
                <Switch checked={true} disabled={true} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Admin</span>
                <Switch checked={formData.allowedRoles.admin} onCheckedChange={checked => handleRoleToggle('admin', checked)} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Employee</span>
                <Switch checked={formData.allowedRoles.employee} onCheckedChange={checked => handleRoleToggle('employee', checked)} />
              </div>
            </div>
          </div>

          {/* Exceptions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Exceptions (Optional)</Label>
            
            {/* Selected employees display */}
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedEmployees.map((employee) => (
                  <Badge key={employee.id} variant="secondary" className="px-2 py-1">
                    {employee.full_name}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(employee.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="relative">
              <Select 
                open={isEmployeeDropdownOpen} 
                onOpenChange={setIsEmployeeDropdownOpen}
                onValueChange={(value) => {
                  const employee = employees.find(emp => emp.id === value);
                  if (employee) {
                    handleEmployeeSelect(employee);
                  }
                  setIsEmployeeDropdownOpen(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employees who can access despite role restrictions..." />
                </SelectTrigger>
                <SelectContent 
                  style={{ zIndex: 999999 }}
                  position="popper"
                  sideOffset={4}
                >
                  {employees.map((employee) => (
                    <SelectItem 
                      key={employee.id} 
                      value={employee.id}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{employee.full_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {employee.employee_id}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  {employees.length === 0 && (
                    <SelectItem value="no-employees" disabled>
                      No employees found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              These employees will have access regardless of their role permissions.
            </p>
          </div>

          {/* Exception Paths */}
          
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.columnType || !formData.columnName || isLoading}
          >
            {isLoading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update Configuration' : 'Create Configuration')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
};