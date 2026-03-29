import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, Trash2, Edit, Save, X, DollarSign } from 'lucide-react';
import { useEmployeePayroll, type EmployeePayrollInfo, type PayrollComponent } from '../../hooks/useEmployeePayroll';
import { usePayrollPeriods } from '../../hooks/usePayrollPeriods';
import { useProfile } from '../../hooks/useProfile';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { toast } from 'sonner';

interface PayrollInfoTabProps {
  isEditMode: boolean;
  onSaveChanges: () => void;
}

export const PayrollInfoTab = ({ isEditMode, onSaveChanges }: PayrollInfoTabProps) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const employeeId = id || searchParams.get('id');
  const { data: profile } = useProfile();
  const { payrollPeriods } = usePayrollPeriods(profile?.active_organization_id);

  const {
    payrollInfo,
    payrollComponents,
    isLoading,
    error,
    savePayrollInfo,
    addPayrollComponent,
    updatePayrollComponent,
    deletePayrollComponent,
  } = useEmployeePayroll(employeeId || '');

  const [formData, setFormData] = useState<Partial<EmployeePayrollInfo>>({
    basic_salary: 0,
    salary_type: 'monthly',
    salary_configuration: 'taxable',
    prorate_based_on: 'working_day',
    count_national_holiday_as_working_day: false,
    ptkp_status: 'TK/0',
    employee_tax_status: 'pegawai_tetap',
    overtime_eligible: false,
    tax_method: 'gross',
    jht_configuration: 'default',
    bpjs_kesehatan_configuration: 'by_company',
    bpjs_kesehatan_family_members: 0,
    currency: 'IDR',
    beginning_netto: 0,
    pph21_paid: 0,
  });

  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<PayrollComponent>>({});
  const [newComponent, setNewComponent] = useState<Partial<PayrollComponent>>({
    component_name: '',
    component_type: 'allowance',
    component_category: '',
    amount: 0,
    is_percentage: false,
    percentage_base: 'basic_salary',
    is_taxable: true,
    is_active: true,
    is_recurring: true,
    payroll_period_id: undefined,
  });


  useEffect(() => {
    if (payrollInfo) {
      setFormData(payrollInfo);
    }
  }, [payrollInfo]);

  const handleSave = async (data: Partial<EmployeePayrollInfo>): Promise<boolean> => {
    try {
      await savePayrollInfo(data);
      return true;
    } catch (error) {
      console.error('Failed to save payroll info:', error);
      return false;
    }
  };

  const { isSaving, lastSaved, hasUnsavedChanges, triggerSave } = useAutoSave({
    onSave: handleSave,
    enabledCondition: isEditMode
  });

  const handleFormChange = useCallback((newFormData: Partial<EmployeePayrollInfo>) => {
    setFormData(newFormData);
    if (isEditMode) {
      triggerSave(newFormData);
    }
  }, [isEditMode, triggerSave]);

  // Expose the save function globally for the parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).savePayrollInfo = async () => {
        try {
          const success = await handleSave(formData);
          if (success) {
            toast.success('Payroll information saved successfully');
            onSaveChanges();
          } else {
            toast.error('Failed to save payroll information');
          }
          return success;
        } catch (error) {
          toast.error('Failed to save payroll information');
          throw error;
        }
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).savePayrollInfo;
      }
    };
  }, [formData, handleSave, onSaveChanges]);

  const handleInputChange = (field: keyof EmployeePayrollInfo, value: any) => {
    const newFormData = { ...formData, [field]: value };
    handleFormChange(newFormData);
  };

  const handleAddComponent = async () => {
    if (!newComponent.component_name || !newComponent.component_category) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await addPayrollComponent(newComponent as Omit<PayrollComponent, 'id' | 'employee_payroll_info_id' | 'organization_id'>);
      setNewComponent({
        component_name: '',
        component_type: 'allowance',
        component_category: '',
        amount: 0,
        is_percentage: false,
        percentage_base: 'basic_salary',
        is_taxable: true,
        is_active: true,
        is_recurring: true,
        payroll_period_id: undefined,
      });
    } catch (error) {
      console.error('Failed to add component:', error);
    }
  };

  const handleUpdateComponent = async (id: string, updatedData: Partial<PayrollComponent>) => {
    try {
      await updatePayrollComponent(id, updatedData);
      setEditingComponent(null);
    } catch (error) {
      console.error('Failed to update component:', error);
    }
  };

  const handleDeleteComponent = async (id: string) => {
    const confirmed = window.confirm(
      'Apakah Anda yakin ingin menghapus komponen payroll ini? ' +
      'Tindakan ini tidak dapat dibatalkan. ' +
      'Catatan: Komponen yang sudah digunakan dalam perhitungan payroll mungkin tidak dapat dihapus.'
    );
    
    if (!confirmed) return;
    
    try {
      await deletePayrollComponent(id);
      toast.success('Komponen payroll berhasil dihapus');
    } catch (error: any) {
      console.error('Failed to delete component:', error);
      
      if (error?.code === '23503') {
        toast.error(
          'Komponen payroll tidak dapat dihapus karena masih digunakan dalam perhitungan payroll. ' +
          'Silakan hapus data payroll terkait terlebih dahulu atau nonaktifkan komponen ini.'
        );
      } else {
        toast.error('Gagal menghapus komponen payroll: ' + (error?.message || 'Unknown error'));
      }
    }
  };

  const handleEditComponent = (component: PayrollComponent) => {
    setEditingComponent(component.id || null);
    setEditingData({
      component_name: component.component_name,
      component_type: component.component_type,
      component_category: component.component_category,
      amount: component.amount,
      is_percentage: component.is_percentage,
      percentage_base: component.percentage_base,
      is_taxable: component.is_taxable,
      is_recurring: component.is_recurring,
      payroll_period_id: component.payroll_period_id,
    });
  };

  const handleCancelEdit = () => {
    setEditingComponent(null);
    setEditingData({});
  };

  const bankOptions = [
    'BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'Danamon', 'Permata', 'Maybank', 'OCBC NISP', 'Bukopin'
  ];

  const ptkpOptions = [
    'TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'
  ];

  if (isLoading) {
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-destructive">Error loading payroll information</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Salary & Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Basic Salary Configuration
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basic_salary">Basic Salary</Label>
              <Input
                id="basic_salary"
                type="number"
                value={formData.basic_salary || 0}
                onChange={(e) => handleInputChange('basic_salary', parseFloat(e.target.value) || 0)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_type">Type Salary</Label>
              <Select
                value={formData.salary_type}
                onValueChange={(value) => handleInputChange('salary_type', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_configuration">Salary Configuration</Label>
              <Select
                value={formData.salary_configuration}
                onValueChange={(value) => handleInputChange('salary_configuration', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxable">Taxable</SelectItem>
                  <SelectItem value="non_taxable">Non-Taxable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="prorate_based_on">Pro Rate Based On</Label>
              <Select
                value={formData.prorate_based_on}
                onValueChange={(value) => handleInputChange('prorate_based_on', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="working_day">Working Day</SelectItem>
                  <SelectItem value="calendar_day">Calendar Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxable_date">Taxable Date</Label>
              <Input
                id="taxable_date"
                type="date"
                value={formData.taxable_date || ''}
                onChange={(e) => handleInputChange('taxable_date', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="flex items-center space-x-2 mt-6">
              <Checkbox
                id="national_holiday"
                checked={formData.count_national_holiday_as_working_day}
                onCheckedChange={(checked) => handleInputChange('count_national_holiday_as_working_day', checked)}
                disabled={!isEditMode || isSaving}
              />
              <Label htmlFor="national_holiday">Count national holiday as a working day</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax & Employment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tax & Employment Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ptkp_status">PTKP Status</Label>
              <Select
                value={formData.ptkp_status}
                onValueChange={(value) => handleInputChange('ptkp_status', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ptkpOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_tax_status">Employee Tax Status</Label>
              <Select
                value={formData.employee_tax_status}
                onValueChange={(value) => handleInputChange('employee_tax_status', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pegawai_tetap">Pegawai Tetap</SelectItem>
                  <SelectItem value="pegawai_tidak_tetap">Pegawai Tidak Tetap</SelectItem>
                  <SelectItem value="ekspatriat">Ekspatriat</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_method">Tax Method</Label>
              <Select
                value={formData.tax_method}
                onValueChange={(value) => handleInputChange('tax_method', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Gross</SelectItem>
                  <SelectItem value="gross_up">Gross Up</SelectItem>
                  <SelectItem value="netto">Netto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="overtime_status">Overtime Status</Label>
              <Select
                value={formData.overtime_eligible ? 'eligible' : 'not_eligible'}
                onValueChange={(value) => handleInputChange('overtime_eligible', value === 'eligible')}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="not_eligible">Not Eligible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jht_configuration">JHT Configuration</Label>
              <Select
                value={formData.jht_configuration}
                onValueChange={(value) => handleInputChange('jht_configuration', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bpjs_configuration">BPJS Kesehatan Configuration</Label>
              <Select
                value={formData.bpjs_kesehatan_configuration}
                onValueChange={(value) => handleInputChange('bpjs_kesehatan_configuration', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="by_company">By Company</SelectItem>
                  <SelectItem value="by_employee">By Employee</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BPJS Information */}
      <Card>
        <CardHeader>
          <CardTitle>BPJS Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bpjs_ketenagakerjaan">BPJS Ketenagakerjaan</Label>
              <Input
                id="bpjs_ketenagakerjaan"
                value={formData.bpjs_ketenagakerjaan_number || ''}
                onChange={(e) => handleInputChange('bpjs_ketenagakerjaan_number', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bpjs_kesehatan">BPJS Kesehatan</Label>
              <Input
                id="bpjs_kesehatan"
                value={formData.bpjs_kesehatan_number || ''}
                onChange={(e) => handleInputChange('bpjs_kesehatan_number', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bpjs_family">BPJS Kesehatan Family</Label>
              <Select
                value={formData.bpjs_kesehatan_family_members?.toString() || '0'}
                onValueChange={(value) => handleInputChange('bpjs_kesehatan_family_members', parseInt(value))}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bpjs_ketenagakerjaan_date">BPJS Ketenagakerjaan Date</Label>
              <Input
                id="bpjs_ketenagakerjaan_date"
                type="date"
                value={formData.bpjs_ketenagakerjaan_date || ''}
                onChange={(e) => handleInputChange('bpjs_ketenagakerjaan_date', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bpjs_kesehatan_date">BPJS Kesehatan Date</Label>
              <Input
                id="bpjs_kesehatan_date"
                type="date"
                value={formData.bpjs_kesehatan_date || ''}
                onChange={(e) => handleInputChange('bpjs_kesehatan_date', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banking & Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Banking & Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="npwp">NPWP</Label>
              <Input
                id="npwp"
                value={formData.npwp || ''}
                onChange={(e) => handleInputChange('npwp', e.target.value)}
                disabled={!isEditMode || isSaving}
                placeholder="00.000.000.0-000.000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Select
                value={formData.bank_name || ''}
                onValueChange={(value) => handleInputChange('bank_name', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {bankOptions.map(bank => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account">Bank Account</Label>
              <Input
                id="bank_account"
                value={formData.bank_account_number || ''}
                onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                disabled={!isEditMode || isSaving}
                placeholder="Account number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_holder">Bank Account Holder</Label>
              <Input
                id="bank_holder"
                value={formData.bank_account_holder || ''}
                onChange={(e) => handleInputChange('bank_account_holder', e.target.value)}
                disabled={!isEditMode || isSaving}
                placeholder="Account holder name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange('currency', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="beginning_netto">Beginning Netto</Label>
              <Input
                id="beginning_netto"
                type="number"
                value={formData.beginning_netto || 0}
                onChange={(e) => handleInputChange('beginning_netto', parseFloat(e.target.value) || 0)}
                disabled={!isEditMode || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pph21_paid">PPH21 Paid</Label>
              <Input
                id="pph21_paid"
                type="number"
                value={formData.pph21_paid || 0}
                onChange={(e) => handleInputChange('pph21_paid', parseFloat(e.target.value) || 0)}
                disabled={!isEditMode || isSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Components */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Payroll Components</CardTitle>
            {isEditMode && (
              <Button onClick={handleAddComponent} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditMode && (
            <div className="bg-muted p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-3">Add New Component</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <Input
                  placeholder="Component name"
                  value={newComponent.component_name}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, component_name: e.target.value }))}
                />
                <Select
                  value={newComponent.component_type}
                  onValueChange={(value) => setNewComponent(prev => ({ ...prev, component_type: value as 'allowance' | 'deduction' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowance">Allowance</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Category"
                  value={newComponent.component_category}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, component_category: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={newComponent.amount}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-is-percentage"
                    checked={newComponent.is_percentage}
                    onCheckedChange={(checked) => setNewComponent(prev => ({ ...prev, is_percentage: !!checked }))}
                  />
                  <Label htmlFor="new-is-percentage">Is Percentage</Label>
                </div>
                
                {newComponent.is_percentage && (
                  <Select
                    value={newComponent.percentage_base}
                    onValueChange={(value) => setNewComponent(prev => ({ ...prev, percentage_base: value as 'basic_salary' | 'gross_salary' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Percentage base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic_salary">Basic Salary</SelectItem>
                      <SelectItem value="gross_salary">Gross Salary</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-is-taxable"
                    checked={newComponent.is_taxable}
                    onCheckedChange={(checked) => setNewComponent(prev => ({ ...prev, is_taxable: !!checked }))}
                  />
                  <Label htmlFor="new-is-taxable">Is Taxable</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-is-recurring"
                    checked={newComponent.is_recurring}
                    onCheckedChange={(checked) => setNewComponent(prev => ({ ...prev, is_recurring: !!checked }))}
                  />
                  <Label htmlFor="new-is-recurring">Is Recurring</Label>
                </div>
              </div>
              
              {!newComponent.is_recurring && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    value={newComponent.payroll_period_id || ''}
                    onValueChange={(value) => setNewComponent(prev => ({ ...prev, payroll_period_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payroll period" />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollPeriods.map(period => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.period_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {payrollComponents.map((component) => (
              <div key={component.id}>
                {editingComponent === component.id ? (
                  // Edit Form
                  <div className="p-4 border rounded-lg bg-muted">
                    <h4 className="font-medium mb-3">Edit Component</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <Input
                        placeholder="Component name"
                        value={editingData.component_name || ''}
                        onChange={(e) => setEditingData(prev => ({ ...prev, component_name: e.target.value }))}
                      />
                      <Select
                        value={editingData.component_type}
                        onValueChange={(value) => setEditingData(prev => ({ ...prev, component_type: value as 'allowance' | 'deduction' }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allowance">Allowance</SelectItem>
                          <SelectItem value="deduction">Deduction</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Category"
                        value={editingData.component_category || ''}
                        onChange={(e) => setEditingData(prev => ({ ...prev, component_category: e.target.value }))}
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={editingData.amount || 0}
                        onChange={(e) => setEditingData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-is-percentage"
                          checked={editingData.is_percentage}
                          onCheckedChange={(checked) => setEditingData(prev => ({ ...prev, is_percentage: !!checked }))}
                        />
                        <Label htmlFor="edit-is-percentage">Is Percentage</Label>
                      </div>
                      
                      {editingData.is_percentage && (
                        <Select
                          value={editingData.percentage_base}
                          onValueChange={(value) => setEditingData(prev => ({ ...prev, percentage_base: value as 'basic_salary' | 'gross_salary' }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Percentage base" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic_salary">Basic Salary</SelectItem>
                            <SelectItem value="gross_salary">Gross Salary</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-is-taxable"
                          checked={editingData.is_taxable}
                          onCheckedChange={(checked) => setEditingData(prev => ({ ...prev, is_taxable: !!checked }))}
                        />
                        <Label htmlFor="edit-is-taxable">Is Taxable</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-is-recurring"
                          checked={editingData.is_recurring}
                          onCheckedChange={(checked) => setEditingData(prev => ({ ...prev, is_recurring: !!checked }))}
                        />
                        <Label htmlFor="edit-is-recurring">Is Recurring</Label>
                      </div>
                    </div>
                    
                    {!editingData.is_recurring && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <Select
                          value={editingData.payroll_period_id || ''}
                          onValueChange={(value) => setEditingData(prev => ({ ...prev, payroll_period_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payroll period" />
                          </SelectTrigger>
                          <SelectContent>
                            {payrollPeriods.map(period => (
                              <SelectItem key={period.id} value={period.id}>
                                {period.period_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComponent(component.id!, editingData)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Display Component
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="font-medium">{component.component_name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          component.component_type === 'allowance' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {component.component_type}
                        </span>
                        <span className="text-sm text-muted-foreground">{component.component_category}</span>
                        <span className="font-medium">
                          {component.is_percentage ? `${component.amount}%` : `${formData.currency} ${component.amount.toLocaleString()}`}
                          {component.is_percentage && ` (${component.percentage_base})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {component.is_taxable && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Taxable</span>
                        )}
                        {component.is_recurring ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Recurring</span>
                        ) : (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                            One-time ({payrollPeriods.find(p => p.id === component.payroll_period_id)?.period_name || 'Unknown Period'})
                          </span>
                        )}
                      </div>
                    </div>
                    {isEditMode && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditComponent(component)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteComponent(component.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

