// Format input number dengan titik sebagai separator ribuan (untuk input field)
export const formatInputNumber = (value: number | string | null | undefined): string => {
  // Handle empty or null values
  if (value === null || value === undefined || value === '') return '';
  
  // If it's already a number, use it directly
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return '';
    const roundedValue = Math.round(value);
    return roundedValue.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  
  // If it's a string, remove all non-digit characters first (except dots for existing formatting)
  const numericValue = value.toString().replace(/[^\d]/g, '');
  
  if (!numericValue) return '';
  
  // Parse to number
  const numValue = parseFloat(numericValue);
  if (isNaN(numValue) || !isFinite(numValue)) return '';
  
  // Round to nearest integer
  const roundedValue = Math.round(numValue);
  
  // Format with dot as thousand separator
  return roundedValue.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Parse input number (remove dots, return number)
export const parseInputNumber = (value: string): number => {
  if (!value) return 0;
  
  // Remove all non-digit characters
  const numericValue = value.replace(/[^\d]/g, '');
  
  if (!numericValue) return 0;
  
  const numValue = parseFloat(numericValue);
  return isNaN(numValue) ? 0 : Math.round(numValue);
};
