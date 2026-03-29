
import { User, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export const ApplicationsOverview = () => {
  // Mock data for demonstration
  const applications = [
    {
      id: '1',
      candidateName: 'John Doe',
      position: 'Frontend Developer',
      appliedDate: '2025-01-10',
      status: 'pending',
      score: '85/100'
    },
    {
      id: '2',
      candidateName: 'Jane Smith',
      position: 'UI/UX Designer',
      appliedDate: '2025-01-09',
      status: 'reviewed',
      score: '92/100'
    }
  ];

  const upcomingInterviews = applications.filter(app => app.status === 'reviewed').slice(0, 5);
  const pendingApplications = applications.filter(app => app.status === 'pending');

  return (
    <div className="bg-white border rounded-lg h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-900">Applications Overview</h3>
        <p className="text-xs text-gray-500 mt-1">Upcoming and pending applications</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-800">Pending Applications</p>
                <p className="text-lg font-bold text-amber-900">{pendingApplications.length}</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-800">For Interview</p>
                <p className="text-lg font-bold text-blue-900">{upcomingInterviews.length}</p>
              </div>
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Recent Applications List */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Recent Applications
          </h4>
          
          {applications.length === 0 ? (
            <div className="text-center py-6">
              <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No applications found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {applications.map((application) => (
                <div key={application.id} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {application.candidateName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {application.position}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-xs font-medium text-gray-900">
                        {application.score}
                      </p>
                      <p className="text-xs text-gray-500">
                        {application.status}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-1 pt-1 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                      Applied: {format(new Date(application.appliedDate), 'MMM dd')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Applications (if any) */}
        {pendingApplications.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Pending Review
            </h4>
            
            <div className="space-y-2">
              {pendingApplications.slice(0, 3).map((application) => (
                <div key={application.id} className="p-2 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-900 truncate">
                        {application.candidateName}
                      </p>
                      <p className="text-xs text-red-600 truncate">
                        {application.position}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-xs font-medium text-red-900">
                        {application.score}
                      </p>
                      <p className="text-xs text-red-600">
                        Pending
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
