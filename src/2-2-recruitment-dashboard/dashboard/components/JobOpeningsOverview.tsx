import { Briefcase, CheckCircle, FileText, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';

interface JobOpeningsOverviewProps {
  jobOpenings?: JobOpening[];
}

export const JobOpeningsOverview = ({ jobOpenings = [] }: JobOpeningsOverviewProps) => {
  const activeJobs = jobOpenings.filter(job => job.status === 'active').length;
  const draftJobs = jobOpenings.filter(job => job.status === 'draft').length;
  const totalApplications = jobOpenings.reduce((sum, job) => sum + (job.submissions || 0), 0);
  const totalClicks = jobOpenings.reduce((sum, job) => sum + (job.clicks || 0), 0);

  // Get unique departments
  const uniqueDepartments = [...new Set(jobOpenings.map(job => job.departments?.name).filter(Boolean))];
  const totalDepartments = uniqueDepartments.length;

  // Get top department (department with most jobs)
  const departmentCounts = uniqueDepartments.map(dept => ({
    name: dept,
    count: jobOpenings.filter(job => job.departments?.name === dept).length
  }));
  const topDepartment = departmentCounts.reduce((max, current) =>
    current.count > max.count ? current : max, departmentCounts[0] || { name: 'N/A', count: 0 });

  // Get recent jobs (last 5)
  const recentJobs = [...jobOpenings]
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-800">Active Jobs</p>
              <p className="text-lg font-bold text-blue-900">{activeJobs}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Total Applications</p>
              <p className="text-lg font-bold text-green-900">{totalApplications}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>

        <div className="p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-800">Total Clicks</p>
              <p className="text-lg font-bold text-purple-900">{totalClicks}</p>
            </div>
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Department Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">Departments</p>
          <span className="text-xs font-bold text-gray-900">{totalDepartments}</span>
        </div>
        {topDepartment.name !== 'N/A' && (
          <p className="text-xs text-gray-600">
            Top: {topDepartment.name} ({topDepartment.count} jobs)
          </p>
        )}
      </div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Recent Jobs</p>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div key={job.id} className="p-2 bg-white rounded border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{job.job_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {job.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{job.location}</span>
                        </div>
                      )}
                      {job.created_at && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(job.created_at), 'MMM dd')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    job.status === 'active' ? 'bg-green-100 text-green-800' :
                    job.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status || 'draft'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
