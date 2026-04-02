
import { ApprovalRequestsFilters } from '../section/ApprovalRequestsFilters';
import { ApprovalRequestsMetricsCards } from '../section/ApprovalRequestsMetricsCards';
import { ApprovalRequestsTable } from '../section/ApprovalRequestsTable';
import { RecentApprovalsOverview } from '../components/RecentApprovalsOverview';

export const ApprovalRequestsPage = () => {
  return (
    <div className="p-2 flex gap-2 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-full">
      {/* Main Content - Adjusted layout ratio */}
      <div className="flex-1" style={{ flex: '1.8' }}>
        {/* Compact Filter Section */}
        <ApprovalRequestsFilters />
        
        {/* Ultra Compact Metrics Section */}
        <div className="mb-2">
          <div className="grid grid-cols-4 gap-1">
            <ApprovalRequestsMetricsCards />
          </div>
        </div>
        
        {/* Approval Requests Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative">
          {/* Modern accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/60 via-indigo-500/40 to-purple-500/30"></div>
          
          <ApprovalRequestsTable />
        </div>
      </div>
      
      {/* Sidebar - Width 480px */}
      <div className="w-96 bg-white/90 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative" style={{ flex: 'none', width: '480px' }}>
        {/* Subtle accent border */}
        <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/40 via-indigo-400/30 to-purple-400/20"></div>
        
        <div className="p-3 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/30 to-white">
          <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Recent Approvals Overview</h3>
          <p className="text-xs text-slate-500">Latest approval activities and status</p>
        </div>
        
        <div className="p-2">
          <RecentApprovalsOverview />
        </div>
      </div>
    </div>
  );
};
