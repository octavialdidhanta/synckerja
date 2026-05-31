import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, User, Calendar, Save, X, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

function assignmentRangesOverlap(
  fromA: string,
  toA: string | null | undefined,
  fromB: string,
  toB: string | null | undefined,
): boolean {
  const endA = toA && toA.trim() !== '' ? toA : '9999-12-31';
  const endB = toB && toB.trim() !== '' ? toB : '9999-12-31';
  return fromA <= endB && fromB <= endA;
}

function findOverlappingAssignment(
  assignments: EmployeeShift[],
  candidate: {
    id?: string;
    employee_id: string;
    effective_from_date: string;
    effective_to_date: string | null;
    is_active: boolean;
  },
): EmployeeShift | undefined {
  if (!candidate.is_active) return undefined;
  return assignments.find(
    (existing) =>
      existing.is_active &&
      existing.employee_id === candidate.employee_id &&
      existing.id !== candidate.id &&
      assignmentRangesOverlap(
        candidate.effective_from_date,
        candidate.effective_to_date,
        existing.effective_from_date,
        existing.effective_to_date,
      ),
  );
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  effective_from_date: string;
  effective_to_date: string | null;
  is_active: boolean;
  employees: Employee;
  shifts: Shift;
}

export const EmployeeShiftAssignment = () => {
  const { t, language } = useAppTranslation();
  const dateLocale = language === 'id' ? id : enUS;
  const [assignments, setAssignments] = useState<EmployeeShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeShift | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  useReportAttendanceSettingsLoading(loading);

  const [formData, setFormData] = useState({
    employee_id: '',
    shift_id: '',
    effective_from_date: '',
    effective_to_date: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.active_organization_id) return;

      // Fetch assignments with employee and shift details
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('employee_shifts')
        .select(`
          *,
          employees!inner(id, full_name, employee_id),
          shifts!inner(id, name, start_time, end_time)
        `)
        .eq('organization_id', profile.active_organization_id)
        .order('effective_from_date', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, full_name, employee_id')
        .eq('organization_id', profile.active_organization_id)
        .order('full_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Fetch shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, name, start_time, end_time')
        .eq('organization_id', profile.active_organization_id)
        .eq('is_active', true)
        .order('name');

      if (shiftsError) throw shiftsError;
      setShifts(shiftsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('employeeShiftAssignment.error.loadFailed', 'Failed to load data'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      shift_id: '',
      effective_from_date: '',
      effective_to_date: '',
      is_active: true
    });
    setEditingAssignment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.active_organization_id) {
        toast({
          title: t('common.error', 'Error'),
          description: t('employeeShiftAssignment.error.organizationNotFound', 'Organization not found'),
          variant: "destructive"
        });
        return;
      }

      if (
        formData.effective_to_date &&
        formData.effective_to_date < formData.effective_from_date
      ) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'employeeShiftAssignment.error.invalidDateRange',
            'End date must be on or after the start date',
          ),
          variant: 'destructive',
        });
        return;
      }

      const overlap = findOverlappingAssignment(assignments, {
        id: editingAssignment?.id,
        employee_id: formData.employee_id,
        effective_from_date: formData.effective_from_date,
        effective_to_date: formData.effective_to_date || null,
        is_active: formData.is_active,
      });

      if (overlap) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'employeeShiftAssignment.error.overlap',
            'This assignment overlaps with an existing active shift for the same employee',
          ),
          variant: 'destructive',
        });
        return;
      }

      const submitData = {
        ...formData,
        effective_to_date: formData.effective_to_date || null,
        organization_id: profile.active_organization_id
      };

      if (editingAssignment) {
        // Update existing assignment
        const { error } = await supabase
          .from('employee_shifts')
          .update(submitData)
          .eq('id', editingAssignment.id);

        if (error) throw error;
        
        toast({
          title: t('common.success', 'Success'),
          description: t('employeeShiftAssignment.success.updated', 'Shift assignment updated successfully')
        });
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('employee_shifts')
          .insert(submitData);

        if (error) throw error;
        
        toast({
          title: t('common.success', 'Success'),
          description: t('employeeShiftAssignment.success.created', 'Shift assignment created successfully')
        });
      }

      resetForm();
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      const message =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23514'
          ? t(
              'employeeShiftAssignment.error.overlap',
              'This assignment overlaps with an existing active shift for the same employee',
            )
          : t('employeeShiftAssignment.error.saveFailed', 'Failed to save shift assignment');
      toast({
        title: t('common.error', 'Error'),
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (assignment: EmployeeShift) => {
    setFormData({
      employee_id: assignment.employee_id,
      shift_id: assignment.shift_id,
      effective_from_date: assignment.effective_from_date,
      effective_to_date: assignment.effective_to_date || '',
      is_active: assignment.is_active
    });
    setEditingAssignment(assignment);
    setShowCreateDialog(true);
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm(t('employeeShiftAssignment.confirmDelete', 'Are you sure you want to delete this shift assignment?'))) return;

    try {
      const { error } = await supabase
        .from('employee_shifts')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      
      toast({
        title: t('common.success', 'Success'),
        description: t('employeeShiftAssignment.success.deleted', 'Shift assignment deleted successfully')
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('employeeShiftAssignment.error.deleteFailed', 'Failed to delete shift assignment'),
        variant: "destructive"
      });
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // Format HH:MM
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        // Try parsing as ISO date format (YYYY-MM-DD)
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateString.split('-');
          const validDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          if (!isNaN(validDate.getTime())) {
            return format(validDate, 'PP', { locale: dateLocale });
          }
        }
        return dateString; // Return original string if all parsing fails
      }
      
      return format(date, 'PP', { locale: dateLocale });
    } catch (error) {
      console.error('Error formatting date:', error, 'for date:', dateString);
      return dateString;
    }
  };

  const shiftOptionLabel = (shift: Shift) => `${shift.name} (${shift.start_time} - ${shift.end_time})`;

  const filteredAssignments = assignments.filter(assignment =>
    assignment.employees.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.employees.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.shifts.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={t('employeeShiftAssignment.searchPlaceholder', 'Search employee or shift...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('employeeShiftAssignment.button.assignShift', 'Assign Shift')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? t('employeeShiftAssignment.form.editTitle', 'Edit Shift Assignment') : t('employeeShiftAssignment.form.addTitle', 'Assign New Shift')}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {t('employeeShiftAssignment.form.description', 'Select employee, determine shift, and set the effective period of the assignment.')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employee_id">{t('employeeShiftAssignment.form.employee', 'Employee')}</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('employeeShiftAssignment.form.selectEmployee', 'Select employee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="shift_id">{t('employeeShiftAssignment.form.shift', 'Shift')}</Label>
                <Select
                  value={formData.shift_id}
                  onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('employeeShiftAssignment.form.selectShift', 'Select shift')} />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shiftOptionLabel(shift)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="effective_from_date">{t('employeeShiftAssignment.form.effectiveFromDate', 'Effective Start Date')}</Label>
                <Input
                  id="effective_from_date"
                  type="date"
                  value={formData.effective_from_date}
                  onChange={(e) => setFormData({ ...formData, effective_from_date: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="effective_to_date">{t('employeeShiftAssignment.form.effectiveToDate', 'End Date (Optional)')}</Label>
                <Input
                  id="effective_to_date"
                  type="date"
                  value={formData.effective_to_date}
                  onChange={(e) => setFormData({ ...formData, effective_to_date: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">{t('employeeShiftAssignment.form.active', 'Active')}</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingAssignment ? t('common.update', 'Update') : t('common.save', 'Save')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredAssignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? t('employeeShiftAssignment.emptyState.noSearchResults', 'No search results') : t('employeeShiftAssignment.emptyState.noAssignments', 'No shift assignments yet')}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? t('employeeShiftAssignment.emptyState.tryDifferentKeywords', 'Try different search keywords') : t('employeeShiftAssignment.emptyState.description', 'Start by assigning employees to shifts')}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('employeeShiftAssignment.button.assignShift', 'Assign Shift')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {assignment.employees.full_name}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {t('employeeShiftAssignment.card.employeeId', 'ID')}: {assignment.employees.employee_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={assignment.is_active ? "default" : "secondary"}>
                      {assignment.is_active ? t('employeeShiftAssignment.status.active', 'Active') : t('employeeShiftAssignment.status.inactive', 'Inactive')}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(assignment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">{t('employeeShiftAssignment.card.shift', 'Shift')}</p>
                    <p className="font-medium">{assignment.shifts.name}</p>
                    <p className="text-gray-500">
                      {formatTime(assignment.shifts.start_time)} - {formatTime(assignment.shifts.end_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('employeeShiftAssignment.card.effectiveDate', 'Effective Date')}</p>
                    <p className="font-medium">
                      {formatDate(assignment.effective_from_date)}
                      {assignment.effective_to_date && (
                        <> - {formatDate(assignment.effective_to_date)}</>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('employeeShiftAssignment.card.status', 'Status')}</p>
                    <p className="font-medium">
                      {assignment.is_active ? t('employeeShiftAssignment.status.active', 'Active') : t('employeeShiftAssignment.status.inactive', 'Inactive')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
