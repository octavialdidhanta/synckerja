// Date utilities for handling timezone-safe date operations

/**
 * Convert Date object to YYYY-MM-DD format in local timezone
 * This prevents timezone offset issues when storing dates
 */
export const formatDateForDatabase = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse date string from database and create Date object in local timezone
 */
export const parseDateFromDatabase = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export const getTodayString = (): string => {
  return formatDateForDatabase(new Date());
};

/**
 * Calculate difference in days between two dates
 */
export const calculateDaysDifference = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Check if a date falls within a date range (inclusive)
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  return checkDate >= start && checkDate <= end;
};
