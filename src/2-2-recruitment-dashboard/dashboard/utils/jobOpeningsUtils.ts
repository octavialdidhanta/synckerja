import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';

export interface JobOpeningsFilters {
  search: string;
  status: string;
  department: string;
  position: string;
  level: string;
  timePeriod: string;
}

export const filterJobOpenings = (
  jobOpenings: JobOpening[],
  filters: JobOpeningsFilters
): JobOpening[] => {
  return jobOpenings.filter((job) => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch =
        job.job_title?.toLowerCase().includes(searchTerm) ||
        job.location?.toLowerCase().includes(searchTerm) ||
        job.departments?.name?.toLowerCase().includes(searchTerm) ||
        job.job_positions?.name?.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (job.status !== filters.status) return false;
    }

    // Department filter
    if (filters.department && filters.department !== 'all') {
      if (job.departments?.name !== filters.department) return false;
    }

    // Position filter
    if (filters.position && filters.position !== 'all') {
      if (job.job_positions?.name !== filters.position) return false;
    }

    // Level filter
    if (filters.level && filters.level !== 'all') {
      if (job.job_levels?.name !== filters.level) return false;
    }

    // Time period filter
    if (filters.timePeriod && filters.timePeriod !== 'all') {
      const now = new Date();
      const jobDate = job.created_at ? new Date(job.created_at) : null;
      
      if (!jobDate) return false;

      switch (filters.timePeriod) {
        case 'today':
          return (
            jobDate.getDate() === now.getDate() &&
            jobDate.getMonth() === now.getMonth() &&
            jobDate.getFullYear() === now.getFullYear()
          );
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return jobDate >= weekAgo;
        case 'month':
          return (
            jobDate.getMonth() === now.getMonth() &&
            jobDate.getFullYear() === now.getFullYear()
          );
        case 'quarter':
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          return jobDate >= quarterStart;
        default:
          return true;
      }
    }

    return true;
  });
};
