import React from 'react';
import { useLeads } from '@/shared/hooks/organized/sales';
import { LeadsMetricsCards } from "@/5-3-dashboard/components/leads/metrics/LeadsMetricsCards";
import { LeadsInsights } from "@/5-3-dashboard/components/leads/metrics/LeadsInsights";
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Users, Clock, Target, CheckCircle } from 'lucide-react';

export const CRMDashboardContent = () => {
  const { leads } = useLeads();

  const totalLeads = leads.length;
  const convertedLeads = leads.filter(lead => lead.lead_status?.name === 'Converted').length;
  const pendingFollowUp = leads.filter(lead => (lead.followup ?? 0) === 0).length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const sourceStats = leads.reduce((acc, lead) => {
    const source = lead.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const consultantStats = leads.reduce((acc, lead) => {
    const consultant = lead.assignee || 'Unknown';
    acc[consultant] = (acc[consultant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryStats = leads.reduce((acc, lead) => {
    const category = lead.category || 'Unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* Key Metrics */}
      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{totalLeads}</div>
            <p className="text-xs text-blue-600 mt-1">
              Semua leads dalam sistem
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Converted Leads</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{convertedLeads}</div>
            <p className="text-xs text-green-600 mt-1">
              Conversion rate: {conversionRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Pending Follow Up</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{pendingFollowUp}</div>
            <p className="text-xs text-orange-600 mt-1">
              Memerlukan tindak lanjut
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{conversionRate}%</div>
            <p className="text-xs text-purple-600 mt-1">
              Tingkat keberhasilan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Stats */}
      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Source Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sumber Leads</CardTitle>
            <p className="text-sm text-gray-500">Distribusi berdasarkan sumber</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(sourceStats).map(([source, count]) => (
              <div key={source} className="flex min-w-0 max-w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{source}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#2E5AAC] h-2 rounded-full" 
                      style={{ width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Consultant Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performa Konsultan</CardTitle>
            <p className="text-sm text-gray-500">Jumlah leads per konsultan</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(consultantStats).map(([consultant, count]) => (
              <div key={consultant} className="flex min-w-0 max-w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{consultant}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Distribution</CardTitle>
            <p className="text-sm text-gray-500">Distribusi berdasarkan kategori</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(categoryStats).map(([category, count]) => (
              <div key={category} className="flex min-w-0 max-w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{category}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Insights Section */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Leads Insights</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <LeadsInsights leads={leads} filters={{}} />
        </CardContent>
      </Card>
    </div>
  );
};

