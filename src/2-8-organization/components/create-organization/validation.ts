
import { OrganizationFormData } from "./types";

export const validateFormData = (formData: OrganizationFormData): string | null => {
  if (!formData.company_name.trim()) {
    return "Nama perusahaan wajib diisi";
  }
  if (!formData.industry) {
    return "Industri wajib dipilih";
  }
  if (!formData.company_size) {
    return "Jumlah karyawan wajib dipilih";
  }
  if (!formData.address.trim()) {
    return "Alamat perusahaan wajib diisi";
  }
  if (!formData.phone_number.trim()) {
    return "Nomor telepon wajib diisi";
  }
  return null;
};

export const validateOrganizationForm = (formData: OrganizationFormData) => {
  const errors: string[] = [];
  
  if (!formData.company_name.trim()) {
    errors.push("Nama perusahaan harus diisi");
  }
  
  if (!formData.industry.trim()) {
    errors.push("Industri harus dipilih");
  }
  
  if (!formData.company_size.trim()) {
    errors.push("Ukuran perusahaan harus dipilih");
  }
  
  if (!formData.address.trim()) {
    errors.push("Alamat perusahaan harus diisi");
  }
  
  if (!formData.phone_number.trim()) {
    errors.push("Nomor telepon harus diisi");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
