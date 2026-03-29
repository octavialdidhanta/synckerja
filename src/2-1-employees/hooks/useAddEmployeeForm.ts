
import { useState } from 'react';
import { EmployeeFormData } from '../types/forms';

export const useAddEmployeeForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<EmployeeFormData>({
    // Personal Data
    name: '',
    email: '',
    mobile_phone: '',
    birth_place: '',
    birth_date: '',
    gender: '',
    marital_status: '',
    religion: '',
    nik: '',
    postal_code: '',
    citizen_address: '',
    address: '',
    blood_type: '',
    nationality: '',
    
    // Personal Documents
    id_card_file: '',
    family_card_file: '',
    cv_file: '',
    
    // Employment Data
    manager_id: '',
    department_id: '',
    job_position_id: '',
    job_level_id: '',
    branch_id: '',
    join_date: '',
    hire_date: '',
    
    // Employment Documents
    contract_file: '',
    certificate_files: [],
    
    // Employee Info
    role: 'employee',
    employee_status_id: '',
    employee_id: '',
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedFormData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof EmployeeFormData] as object || {}),
        [field]: value
      }
    }));
  };

  const resetFormData = () => {
    setFormData({
      // Personal Data
      name: '',
      email: '',
      mobile_phone: '',
      birth_place: '',
      birth_date: '',
      gender: '',
      marital_status: '',
      religion: '',
      nik: '',
      postal_code: '',
      citizen_address: '',
      address: '',
      blood_type: '',
      nationality: '',
      
      // Personal Documents
      id_card_file: '',
      family_card_file: '',
      cv_file: '',
      
      // Employment Data
      manager_id: '',
      department_id: '',
      job_position_id: '',
      job_level_id: '',
      branch_id: '',
      join_date: '',
      hire_date: '',
      
      // Employment Documents
      contract_file: '',
      certificate_files: [],
      
      // Employee Info
      role: 'employee',
      employee_status_id: '',
      employee_id: '',
    });
  };

  const setSubmitting = (submitting: boolean) => {
    setIsSubmitting(submitting);
  };

  const resetForm = () => {
    resetFormData();
  };

  return {
    formData,
    isSubmitting,
    updateFormData,
    updateNestedFormData,
    resetFormData,
    setFormData,
    setSubmitting,
    resetForm
  };
};
