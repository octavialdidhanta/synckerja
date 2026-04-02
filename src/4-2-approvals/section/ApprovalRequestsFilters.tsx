
import { useState } from 'react';
import { Search, Filter, Plus, Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

export const ApprovalRequestsFilters = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/60 p-3 mb-3 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs h-8 border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs border-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white border shadow-lg">
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="approved" className="text-xs">Approved</SelectItem>
            <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs border-slate-200">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-white border shadow-lg">
            <SelectItem value="all" className="text-xs">All Types</SelectItem>
            <SelectItem value="purchase" className="text-xs">Purchase</SelectItem>
            <SelectItem value="reimbursement" className="text-xs">Reimbursement</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Request
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};
