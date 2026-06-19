
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  CompanyProfileHeader,
  CompanyBasicInfo,
  CompanyMissionVision,
  CompanyDepartments,
  CompanyValues,
} from '../components';
import { useCompanyProfile, useCompanyLogo, useUpdateCompany } from '../hooks';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const CompanyProfileDashboard = () => {
  const { data: currentEmployee } = useCurrentUserEmployee();
  const { data: companyData } = useCompanyProfile();
  const { logoUrl, updateLogo } = useCompanyLogo();
  const { organizationId } = useCurrentOrg();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();

  const { data: departmentsData = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments-with-counts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { departments, totalEmployees } = useMemo(() => {
    const deptCounts = new Map<string, number>();
    
    employees.forEach(emp => {
      if (emp.department_id) {
        deptCounts.set(emp.department_id, (deptCounts.get(emp.department_id) || 0) + 1);
      }
    });

    const depts = departmentsData.map(dept => ({
      id: dept.id,
      name: dept.name,
      employee_count: deptCounts.get(dept.id) || 0,
    }));

    return {
      departments: depts,
      totalEmployees: employees.length,
    };
  }, [departmentsData, employees]);

  const isDepartmentsLoading = departmentsLoading || employeesLoading;
  const [isEditMode, setIsEditMode] = useState(false);
  const updateCompanyMutation = useUpdateCompany();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    phone_number: '',
    website: '',
    email: '',
    industry: '',
    description: '',
    tax_id: '',
    established: '',
    about_us: '',
    mission: '',
    vision: '',
  });

  useEffect(() => {
    if (companyData) {
      setFormData({
        company_name: companyData.company_name || '',
        address: companyData.address || '',
        phone_number: companyData.phone_number || '',
        website: companyData.website || '',
        email: companyData.email || '',
        industry: companyData.industry || '',
        description: companyData.description || '',
        tax_id: companyData.tax_id || '',
        established: companyData.established || '',
        about_us: companyData.about_us || '',
        mission: companyData.mission || '',
        vision: companyData.vision || '',
      });
    }
  }, [companyData]);

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    if (companyData) {
      setFormData({
        company_name: companyData.company_name || '',
        address: companyData.address || '',
        phone_number: companyData.phone_number || '',
        website: companyData.website || '',
        email: companyData.email || '',
        industry: companyData.industry || '',
        description: companyData.description || '',
        tax_id: companyData.tax_id || '',
        established: companyData.established || '',
        about_us: companyData.about_us || '',
        mission: companyData.mission || '',
        vision: companyData.vision || '',
      });
    }
    setIsEditMode(false);
  };

  const handleSave = async () => {
    const trimmedName = formData.company_name.trim();
    if (!trimmedName) {
      toast({
        title: 'Company name required',
        description: 'Please enter a company name before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateCompanyMutation.mutateAsync({
        ...formData,
        company_name: trimmedName,
      });
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to save company data:', error);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const displayCompanyData = {
    company_name: companyData?.company_name || 'Demo Company Ltd',
    address: companyData?.address || 'Jakarta, Indonesia',
    phone_number: companyData?.phone_number || '+62 21 1234 5678',
    website: companyData?.website || 'www.democompany.com',
    email: companyData?.email || 'contact@democompany.com',
    established: companyData?.established || '',
    employee_count: totalEmployees > 0 ? `${totalEmployees}` : '0',
    tax_id: companyData?.tax_id || '123456789',
    industry: companyData?.industry || 'Technology',
    description: companyData?.description || 'A leading technology company',
    mission: companyData?.mission || '',
    vision: companyData?.vision || '',
    about_us: companyData?.about_us || ''
  };

  return (
    <div className="w-full max-w-none space-y-2 sm:space-y-3">
      <CompanyProfileHeader 
        companyName={isEditMode ? formData.company_name : displayCompanyData.company_name}
        logoUrl={logoUrl}
        isEditMode={isEditMode}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onSave={handleSave}
        isSaving={updateCompanyMutation.isPending}
        onLogoUpdate={updateLogo}
        onCompanyNameChange={(value) => handleFieldChange('company_name', value)}
      />
      
      <div className="grid grid-cols-1 gap-2 sm:gap-3 xl:grid-cols-3">
        <div className="min-w-0 space-y-2 sm:space-y-3 xl:col-span-2">
          <CompanyBasicInfo 
            companyData={displayCompanyData} 
            formData={formData}
            isEditMode={isEditMode}
            onFieldChange={handleFieldChange}
          />
          <CompanyMissionVision 
            formData={formData}
            isEditMode={isEditMode}
            onFieldChange={handleFieldChange}
          />
        </div>
        
        <div className="min-w-0 space-y-2 sm:space-y-3">
          <CompanyDepartments 
            departments={departments} 
            isLoading={isDepartmentsLoading} 
          />
          <CompanyValues />
        </div>
      </div>
    </div>
  );
};
