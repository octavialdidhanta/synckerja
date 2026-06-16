import React from 'react';
import { LeadsInsights } from "@/5-3-dashboard/components/leads/metrics/LeadsInsights";
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Users, Clock, Target, CheckCircle } from 'lucide-react';
import type { NewLead } from '@/shared/types/leads';

type CRMDashboardContentProps = {
  leads: NewLead[];
};

/** CRM dashboard metrics: org-wide leads (same scope as `CrmConversationSummaryPanel`; RLS-bound). */
export const CRMDashboardContent = ({ leads }: CRMDashboardContentProps) => {

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
        <Card className="border border-brand-blue/20 bg-gradient-to-br from-brand-blue-soft to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-brand-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-blue">{totalLeads}</div>
            <p className="mt-1 text-xs text-brand-blue/80">
              Semua leads dalam sistem
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-red/20 bg-gradient-to-br from-brand-red/10 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-red">Converted Leads</CardTitle>
            <CheckCircle className="h-4 w-4 text-brand-red" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-red">{convertedLeads}</div>
            <p className="mt-1 text-xs text-brand-red/80">
              Conversion rate: {conversionRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-blue/15 bg-gradient-to-br from-brand-blue-soft/80 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">Pending Follow Up</CardTitle>
            <Clock className="h-4 w-4 text-brand-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-blue">{pendingFollowUp}</div>
            <p className="mt-1 text-xs text-brand-blue/80">
              Memerlukan tindak lanjut
            </p>
          </CardContent>
        </Card>

        <Card className="border border-brand-red/15 bg-gradient-to-br from-brand-red/10 to-brand-blue-soft/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-red">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-brand-red" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-red">{conversionRate}%</div>
            <p className="mt-1 text-xs text-brand-red/80">
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
                      className="h-2 rounded-full bg-brand-blue"
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
                      className="h-2 rounded-full bg-brand-red"
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
                      className="h-2 rounded-full bg-brand-blue-deep"
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

