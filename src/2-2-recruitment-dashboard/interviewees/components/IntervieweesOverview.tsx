import { Calendar, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Interviewee {
  id: string;
  name: string;
  position?: string;
  interview_date?: string;
  status: string;
  interviewer?: string;
}

interface IntervieweesOverviewProps {
  interviewees?: Interviewee[];
}

export const IntervieweesOverview = ({ interviewees = [] }: IntervieweesOverviewProps) => {
  const scheduledInterviews = interviewees.filter(i => i.status === 'scheduled').length;
  const completedInterviews = interviewees.filter(i => i.status === 'completed').length;
  
  // Calculate this week's interviews
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const thisWeekInterviews = interviewees.filter(i => {
    if (!i.interview_date) return false;
    const interviewDate = new Date(i.interview_date);
    return interviewDate >= startOfWeek && interviewDate <= today;
  }).length;

  // Get upcoming interviews (scheduled, sorted by date)
  const upcomingInterviews = [...interviewees]
    .filter(i => i.status === 'scheduled' && i.interview_date)
    .sort((a, b) => {
      const dateA = a.interview_date ? new Date(a.interview_date).getTime() : 0;
      const dateB = b.interview_date ? new Date(b.interview_date).getTime() : 0;
      return dateA - dateB;
    })
    .slice(0, 5);

  // Get recently completed interviews
  const recentCompleted = [...interviewees]
    .filter(i => i.status === 'completed' && i.interview_date)
    .sort((a, b) => {
      const dateA = a.interview_date ? new Date(a.interview_date).getTime() : 0;
      const dateB = b.interview_date ? new Date(b.interview_date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 3);

  const getDaysUntilInterview = (dateString: string) => {
    const interviewDate = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-800">Scheduled</p>
              <p className="text-lg font-bold text-blue-900">{scheduledInterviews}</p>
            </div>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">This Week</p>
              <p className="text-lg font-bold text-green-900">{thisWeekInterviews}</p>
            </div>
            <Clock className="w-5 h-5 text-green-600" />
          </div>
        </div>

        <div className="p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-800">Completed</p>
              <p className="text-lg font-bold text-purple-900">{completedInterviews}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Upcoming Interviews List */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Upcoming Interviews
        </h4>
        
        {upcomingInterviews.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No upcoming interviews</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingInterviews.map((interview) => (
              <div key={interview.id} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {interview.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {interview.position || '-'}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-xs font-medium text-gray-900">
                      {interview.interview_date ? format(new Date(interview.interview_date), 'HH:mm') : '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {interview.interview_date ? getDaysUntilInterview(interview.interview_date) : '-'}
                    </p>
                  </div>
                </div>
                
                {interview.interviewer && (
                  <div className="mt-1 pt-1 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                      Interviewer: {interview.interviewer}
                    </p>
                    {interview.interview_date && (
                      <p className="text-xs text-gray-400">
                        {format(new Date(interview.interview_date), 'MMM dd')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Completed */}
      {recentCompleted.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-green-700 mb-3 flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            Recently Completed
          </h4>
          
          <div className="space-y-2">
            {recentCompleted.map((interview) => (
              <div key={interview.id} className="p-2 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-green-900 truncate">
                      {interview.name}
                    </p>
                    <p className="text-xs text-green-600 truncate">
                      {interview.position || '-'}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-xs font-medium text-green-900">
                      Completed
                    </p>
                    {interview.interview_date && (
                      <p className="text-xs text-green-600">
                        {format(new Date(interview.interview_date), 'MMM dd')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
