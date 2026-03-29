
import { supabase } from '@/shared/lib/supabaseClient';
import { EmployeeFormData } from '../types/forms';

export const useEmployeeValidation = (formData: EmployeeFormData) => {
  const validatePersonalData = () => {
    return !!(
      formData.name?.trim() &&
      formData.email?.trim() &&
      formData.mobile_phone?.trim()
    );
  };

  const validateEmploymentData = () => {
    return !!(
      formData.manager_id &&
      formData.department_id &&
      formData.job_position_id &&
      formData.job_level_id &&
      formData.branch_id &&
      formData.join_date &&
      formData.role &&
      formData.employee_status_id
    );
  };

  const validateInviteData = () => {
    // For invite step, we just need the previous steps to be valid
    // and ensure we have an email for sending the magic link
    return validatePersonalData() && validateEmploymentData() && !!formData.email;
  };

  const validateNikFormat = (nik: string) => {
    // NIK should be exactly 16 digits
    const nikRegex = /^\d{16}$/;
    return nikRegex.test(nik);
  };

  const checkNikUniqueness = async (nik: string) => {
    if (!nik || !validateNikFormat(nik)) {
      return { isValid: false, message: 'NIK must be exactly 16 digits' };
    }

    try {
      const { data: existingEmployee, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('nik', nik)
        .maybeSingle();

      if (error) {
        console.error('Error checking NIK uniqueness:', error);
        return { isValid: false, message: 'Error checking NIK availability' };
      }

      if (existingEmployee) {
        return { 
          isValid: false, 
          message: `NIK ${nik} is already registered to ${existingEmployee.full_name}` 
        };
      }

      return { isValid: true, message: 'NIK is available' };
    } catch (error) {
      console.error('Error checking NIK uniqueness:', error);
      return { isValid: false, message: 'Error checking NIK availability' };
    }
  };

  return {
    validatePersonalData,
    validateEmploymentData,
    validateInviteData,
    validateNikFormat,
    checkNikUniqueness
  };
};

export const validateEmployeeData = async (formData: any, organizationId: string) => {
  // Handle branch validation
  let branchId = null;
  if (formData.branch) {
    if (formData.branch.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      branchId = formData.branch;
    } else {
      const { data: branch } = await supabase
        .from("branches")
        .select("id")
        .or(`name.eq.${formData.branch},code.eq.${formData.branch}`)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (branch?.id) branchId = branch.id;
    }
  }

  return {
    branchId
  };
};

export const getEntityName = async (table: string, id: string | undefined): Promise<string | null> => {
  if (!id) return null;
  
  try {
    // Fix TS2339: Use proper type handling for different table queries
    if (table === "departments") {
      const { data, error } = await supabase
        .from("departments")
        .select('name')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching entity name from ${table}:`, error);
        return null;
      }
      
      return data?.name || null;
    } else if (table === "job_positions") {
      const { data, error } = await supabase
        .from("job_positions")
        .select('name')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching entity name from ${table}:`, error);
        return null;
      }
      
      return data?.name || null;
    } else if (table === "job_levels") {
      const { data, error } = await supabase
        .from("job_levels")
        .select('name')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching entity name from ${table}:`, error);
        return null;
      }
      
      return data?.name || null;
    } else if (table === "branches") {
      const { data, error } = await supabase
        .from("branches")
        .select('name')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching entity name from ${table}:`, error);
        return null;
      }
      
      return data?.name || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error in getEntityName for ${table}:`, error);
    return null;
  }
};
