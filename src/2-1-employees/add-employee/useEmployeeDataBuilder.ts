
import { EmployeeFormData } from '../types/forms';
import { validateEmployeeData } from '../hooks/useEmployeeValidation';

export const buildEmployeeData = async (
  formData: EmployeeFormData,
  organizationId: string,
  userId: string
) => {
  const { branchId } = await validateEmployeeData(formData, organizationId);

  // Handle certificate files as JSON string
  let certificateFilesString: string | null = null;
  if (formData.certificate_files && Array.isArray(formData.certificate_files) && formData.certificate_files.length > 0) {
    certificateFilesString = JSON.stringify(formData.certificate_files);
  }

  // Build comprehensive employee data object with all fields
  const employeeData: any = {
    // Personal Information
    full_name: formData.name,
    email: formData.email,
    mobile_phone: formData.mobile_phone,
    birth_place: formData.birth_place,
    birth_date: formData.birth_date || null,
    gender: formData.gender,
    marital_status: formData.marital_status,
    religion: formData.religion,
    nik: formData.nik,
    // Note: nationality field removed as it doesn't exist in employees table
    
    // Address Information
    citizen_address: formData.citizen_address,
    address: formData.address,
    postal_code: formData.postal_code,
    
    // Employment Information - Use ONLY foreign key columns
    manager_id: formData.manager_id,
    department_id: formData.department_id,
    job_position_id: formData.job_position_id,
    job_level_id: formData.job_level_id,
    branch_id: branchId,
    employee_status_id: formData.employee_status_id || formData.status || null,
    join_date: formData.join_date || null,
    hire_date: formData.hire_date || null,
    
    // Document Files
    id_card_file: formData.id_card_file,
    family_card_file: formData.family_card_file,
    cv_file: formData.cv_file,
    contract_file: formData.contract_file,
    certificate_files: certificateFilesString,
    
    // System fields
    organization_id: organizationId,
    user_id: userId,
  };

  // Only assign employee_id if explicitly set (otherwise will be autogen by DB)
  if (formData.employee_id && formData.employee_id.trim()) {
    employeeData.employee_id = formData.employee_id;
  }

  return employeeData;
};
