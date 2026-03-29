import type { IntervieweesFiltersType } from '../components/IntervieweesFilters';

export interface Interviewee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  interview_date?: string;
  status: string;
  department?: string;
  interviewer?: string;
}

export const filterInterviewees = (
  interviewees: Interviewee[],
  filters: IntervieweesFiltersType
): Interviewee[] => {
  let filtered = [...interviewees];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (interviewee) =>
        interviewee.name?.toLowerCase().includes(searchLower) ||
        interviewee.email?.toLowerCase().includes(searchLower) ||
        interviewee.phone?.toLowerCase().includes(searchLower) ||
        interviewee.position?.toLowerCase().includes(searchLower)
    );
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter((interviewee) => interviewee.status === filters.status);
  }

  // Position filter
  if (filters.position && filters.position !== 'all') {
    filtered = filtered.filter((interviewee) => interviewee.position === filters.position);
  }

  // Department filter
  if (filters.department && filters.department !== 'all') {
    filtered = filtered.filter((interviewee) => interviewee.department === filters.department);
  }

  // Date range filter
  if (filters.dateRange && filters.dateRange !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered = filtered.filter((interviewee) => {
      if (!interviewee.interview_date) return false;
      const interviewDate = new Date(interviewee.interview_date);
      interviewDate.setHours(0, 0, 0, 0);

      switch (filters.dateRange) {
        case 'today':
          return interviewDate.getTime() === today.getTime();
        case 'thisWeek': {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          return interviewDate >= startOfWeek && interviewDate <= today;
        }
        case 'thisMonth': {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          return interviewDate >= startOfMonth && interviewDate <= today;
        }
        default:
          return true;
      }
    });
  }

  return filtered;
};
