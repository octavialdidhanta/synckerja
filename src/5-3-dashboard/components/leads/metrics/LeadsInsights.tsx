import React, { useState, useEffect } from 'react';
import { NewLead } from '@/shared/types/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { TrendingUp, Users, Calendar, Target, Download, FileText, BarChart3, MapPin, Loader2, User2, LineChart, ChevronDown } from 'lucide-react';
import { generateLeadsPDF } from "@/5-3-dashboard/lib/LeadsPDFGenerator";
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { useLeadsInsightsSupplementalQueries } from '@/5-3-dashboard/hooks/useLeadsInsightsSupplementalQueries';

function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface LeadsInsightsProps {
  leads: NewLead[];
  filters?: any;
  clientStatuses?: Record<string, 'full' | 'partial' | 'empty'>;
  clientProfiles?: Record<string, any>;
  /** When provided, show ALL agents (employees) with their lead/chat count; agents with 0 leads are included. */
  allEmployees?: Array<{ id: string; full_name: string; email: string }>;
  /** When provided, fetch WhatsApp cycle metrics (response time, time to resolve) per assignee. */
  organizationId?: string;
  /** Controlled active tab (overview | source-performance | consultant-performance). When set, onActiveTabChange is required. */
  activeTab?: string;
  /** Callback when tab changes (for mobile drawer). */
  onActiveTabChange?: (tab: string) => void;
  /** When true, hide the tab dropdown (e.g. when tab is controlled from a drawer). */
  hideTabDropdown?: boolean;
  /** When true (e.g. mobile report view), sections use tighter spacing and stronger borders. */
  denserSections?: boolean;
}

export const LeadsInsights = ({
  leads,
  filters,
  clientStatuses = {},
  clientProfiles = {},
  allEmployees = [],
  organizationId,
  activeTab: activeTabProp,
  onActiveTabChange,
  hideTabDropdown = false,
  denserSections = false,
}: LeadsInsightsProps) => {
  const [internalTab, setInternalTab] = useState('overview');
  const isControlled = activeTabProp !== undefined;
  const activeTab = isControlled ? activeTabProp : internalTab;
  const setActiveTab = isControlled ? (onActiveTabChange ?? (() => {})) : setInternalTab;

  const sectionCardClass = (base: string) => {
    let result = base.replace("border-none", "border border-border");
    if (denserSections) {
      result = result.replace(/shadow-sm|shadow/g, "shadow-none");
    }
    return result;
  };

  const sectionSpacingClass = denserSections ? 'space-y-1 mt-1' : 'space-y-3 mt-4';
  const outerSpacingClass = denserSections ? 'space-y-1' : 'space-y-4';

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { cycleRows, leadStatusesFromDb, isCycleMetricsError } = useLeadsInsightsSupplementalQueries(organizationId);

  const totalLeads = leads.length;

  // Treat as Converted if status name is "Converted" (trim + case-insensitive, so DB "Converted "/"CONVERTED" still count)
  const isConvertedLead = (lead: { lead_status?: { name?: string | null } | null }) =>
    (lead.lead_status?.name?.trim().toLowerCase() ?? '') === 'converted';
  const TERMINAL_STATUS_NAMES = ['lost', 'closed', 'converted'];
  const isTerminalStatus = (lead: { lead_status?: { name?: string | null } | null }) =>
    TERMINAL_STATUS_NAMES.includes(lead.lead_status?.name?.trim().toLowerCase() ?? '');

  // Calculate conversion metrics with proper date filtering
  const convertedLeads = leads.filter(lead => isConvertedLead(lead));
  
  // Calculate "Conversion Deal Periode Ini" based on date filters and lead converted_at field
  const calculateConversionDealPeriode = () => {
    if (!filters?.dateRange?.from || !filters?.dateRange?.to) {
      return convertedLeads.length;
    }

    const filterFrom = new Date(filters.dateRange.from);
    filterFrom.setHours(0, 0, 0, 0);
    const filterTo = new Date(filters.dateRange.to);
    filterTo.setHours(23, 59, 59, 999);

    const conversionsInPeriod = convertedLeads.filter(lead => {
      if (!lead.converted_at) return false;
      const convertedDate = new Date(lead.converted_at);
      return convertedDate >= filterFrom && convertedDate <= filterTo;
    });

    return conversionsInPeriod.length;
  };

  const convertedCount = calculateConversionDealPeriode();
  const conversionRate = totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;
  
  // Get Month-to-Date conversions (from beginning of month to current real date - independent of filters)
  const getMonthToDateConversions = () => {
    // Always use current real date, never use date filter
    const today = new Date();
    
    // Get the first day of the current month - use UTC to avoid timezone issues
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDayOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    
    const endOfToday = new Date(year, month, today.getDate(), 23, 59, 59, 999);

    const filteredConversions = convertedLeads.filter(lead => {
      if (!lead.converted_at) return false;
      const convertedDate = new Date(lead.converted_at);
      return convertedDate >= firstDayOfMonth && convertedDate <= endOfToday;
    });

    return filteredConversions;
  };
  
  const monthToDateConversions = getMonthToDateConversions();

  // Calculate data completeness based on actual client status indicators
  const completeDataCount = leads.filter(lead => {
    const clientStatus = clientStatuses[lead.id];
    return clientStatus === 'full';
  }).length;
  const incompleteDataCount = leads.filter(lead => {
    const clientStatus = clientStatuses[lead.id];
    return clientStatus === 'partial';
  }).length;
  const noDataCount = leads.filter(lead => {
    const clientStatus = clientStatuses[lead.id];
    return clientStatus === 'empty';
  }).length;

  // Priority analysis based on fu_priority field
  const hotProspectCount = leads.filter(lead => lead.fu_priority === 'High').length;
  const warmProspectCount = leads.filter(lead => lead.fu_priority === 'Medium').length;
  const coldProspectCount = leads.filter(lead => lead.fu_priority === 'Low').length;

  // Source analysis - get unique sources from actual leads data
  const uniqueSources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];
  const sourceAnalysis = uniqueSources.map(source => {
    const sourceLeads = leads.filter(lead => lead.source === source);
    const percentage = totalLeads > 0 ? sourceLeads.length / totalLeads * 100 : 0;
    return {
      source,
      count: sourceLeads.length,
      percentage: Math.round(percentage)
    };
  }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

  // Services analysis
  const servicesAnalysis = [...new Set(leads.map(lead => lead.services).filter(Boolean))].map(service => {
    const serviceLeads = leads.filter(lead => lead.services === service);
    return {
      service: service || 'Not Specified',
      count: serviceLeads.length
    };
  });

  // Location analysis - get location from client profiles
  const getLocationFromProfile = (leadId: string) => {
    const profile = clientProfiles[leadId];
    if (!profile) return 'Unknown';
    return profile.location || 'Unknown';
  };
  const locationAnalysis = [...new Set(leads.map(lead => getLocationFromProfile(lead.id)))].map(location => {
    const locationLeads = leads.filter(lead => getLocationFromProfile(lead.id) === location);
    return {
      location,
      count: locationLeads.length
    };
  });

  // Category analysis
  const categoryAnalysis = [...new Set(leads.map(lead => lead.category).filter(Boolean))].map(category => {
    const categoryLeads = leads.filter(lead => lead.category === category);
    return {
      category: category || 'Not Specified',
      count: categoryLeads.length,
      percentage: totalLeads > 0 ? Math.round(categoryLeads.length / totalLeads * 100) : 0
    };
  }).sort((a, b) => b.count - a.count);

  // Gender analysis - get gender from client profiles
  const getGenderFromProfile = (leadId: string) => {
    const profile = clientProfiles[leadId];
    if (!profile) return 'Unknown';

    // Check different possible gender values and formats
    const gender = profile.gender;
    if (!gender) return 'Unknown';

    // Handle different possible gender formats
    const genderLower = gender.toLowerCase();
    if (genderLower === 'male' || genderLower === 'laki-laki' || genderLower === 'm') {
      return 'Male';
    } else if (genderLower === 'female' || genderLower === 'perempuan' || genderLower === 'f') {
      return 'Female';
    }
    return 'Unknown';
  };
  const genderAnalysis = {
    male: leads.filter(lead => getGenderFromProfile(lead.id) === 'Male').length,
    female: leads.filter(lead => getGenderFromProfile(lead.id) === 'Female').length,
    unknown: leads.filter(lead => getGenderFromProfile(lead.id) === 'Unknown').length
  };

  // Enhanced location analysis with percentages
  const enhancedLocationAnalysis = [...new Set(leads.map(lead => getLocationFromProfile(lead.id)))].map(location => {
    const locationLeads = leads.filter(lead => getLocationFromProfile(lead.id) === location);
    return {
      location,
      count: locationLeads.length,
      percentage: totalLeads > 0 ? Math.round(locationLeads.length / totalLeads * 100) : 0
    };
  }).sort((a, b) => b.count - a.count);

  // Status analysis — sinkron dengan sidebar quick action & kolom status tabel leads: urutan dan daftar dari lead_statuses (DB)
  const statusAnalysis = (() => {
    if (organizationId && leadStatusesFromDb.length > 0) {
      const rows: { status: string; count: number }[] = leadStatusesFromDb.map((s) => ({
        status: s.name,
        count: leads.filter((l) => (l.lead_status?.name ?? '').trim() === s.name.trim()).length,
      }));
      const notSpecifiedCount = leads.filter((l) => !l.lead_status?.name || (l.lead_status.name ?? '').trim() === '').length;
      if (notSpecifiedCount > 0) {
        rows.push({ status: 'Not Specified', count: notSpecifiedCount });
      }
      return rows;
    }
    // Fallback tanpa organizationId: kelompokkan dari leads saja (urutan by count)
    const statusMap = new Map<string, number>();
    leads.forEach((lead) => {
      const statusName = lead.lead_status?.name || 'Not Specified';
      statusMap.set(statusName, (statusMap.get(statusName) || 0) + 1);
    });
    return Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  })();

  // Employee performance analysis with conversion tracking
  const unassignedLeads = leads.filter(lead => !lead.assignee || !String(lead.assignee).trim());
  const leadAssigneeId = (lead: NewLead) => (lead as NewLead & { assignee_id?: string | null }).assignee_id;
  type EmployeeAnalysisItem = { employee: string; employeeId: string; employeeIds: string[]; totalLeads: number; convertedLeads: number; conversionRate: number; activeLeads: number };
  let employeeAnalysis: EmployeeAnalysisItem[];
  if (allEmployees && allEmployees.length > 0) {
    // Deduplicate by unique display name so each agent appears once (nama agent Unique)
    const byName = new Map<string, { displayName: string; ids: string[] }>();
    for (const emp of allEmployees) {
      const name = (emp.full_name || emp.email || '').trim() || 'Agent';
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { displayName: name, ids: [emp.id] });
      else byName.get(key)!.ids.push(emp.id);
    }
    const uniqueAgents = [...byName.values()];
    employeeAnalysis = uniqueAgents.map(({ displayName, ids }) => {
      const assigneeLeads = leads.filter(lead =>
        (lead.assignee && (lead.assignee === displayName || lead.assignee === (allEmployees!.find(e => e.id === ids[0])?.email ?? ''))) ||
        (leadAssigneeId(lead) && ids.includes(leadAssigneeId(lead)!))
      );
      const convertedLeads = assigneeLeads.filter(lead => isConvertedLead(lead));
      const activeLeads = assigneeLeads.filter(lead => !isTerminalStatus(lead)).length;
      const conversionRate = assigneeLeads.length > 0 ? convertedLeads.length / assigneeLeads.length * 100 : 0;
      return {
        employee: displayName,
        employeeId: ids[0],
        employeeIds: ids,
        totalLeads: assigneeLeads.length,
        convertedLeads: convertedLeads.length,
        conversionRate: Math.round(conversionRate * 10) / 10,
        activeLeads
      };
    });
  } else {
    const assigneesWithLeads = [...new Set(leads.map(lead => lead.assignee).filter(Boolean))];
    employeeAnalysis = assigneesWithLeads.map(assignee => {
      const assigneeLeads = leads.filter(lead => lead.assignee === assignee);
      const convertedLeads = assigneeLeads.filter(lead => isConvertedLead(lead));
      const activeLeads = assigneeLeads.filter(lead => !isTerminalStatus(lead)).length;
      const conversionRate = assigneeLeads.length > 0 ? convertedLeads.length / assigneeLeads.length * 100 : 0;
      return {
        employee: assignee || 'Unassigned',
        employeeId: assignee || 'unassigned',
        employeeIds: [],
        totalLeads: assigneeLeads.length,
        convertedLeads: convertedLeads.length,
        conversionRate: Math.round(conversionRate * 10) / 10,
        activeLeads
      };
    });
    if (employeeAnalysis.length === 0 && unassignedLeads.length > 0) {
      const converted = unassignedLeads.filter(lead => isConvertedLead(lead)).length;
      const rate = unassignedLeads.length > 0 ? (converted / unassignedLeads.length) * 100 : 0;
      employeeAnalysis = [{
        employee: 'Unassigned',
        employeeId: 'unassigned',
        employeeIds: [],
        totalLeads: unassignedLeads.length,
        convertedLeads: converted,
        conversionRate: Math.round(rate * 10) / 10,
        activeLeads: unassignedLeads.filter(lead => !isTerminalStatus(lead)).length
      }];
    }
  }
  employeeAnalysis = employeeAnalysis.sort((a, b) => b.conversionRate - a.conversionRate);

  const filterFrom = filters?.dateRange?.from ? new Date(filters.dateRange.from) : null;
  const filterTo = filters?.dateRange?.to ? new Date(filters.dateRange.to) : null;
  const cycleMetricsByAssignee = (() => {
    const map = new Map<string, { avgResponseFormatted: string; avgResolveFormatted: string }>();
    const filtered = filterFrom && filterTo
      ? cycleRows.filter((r) => {
          const started = new Date(r.cycle_started_at).getTime();
          const resolved = r.resolved_at ? new Date(r.resolved_at).getTime() : started;
          const from = filterFrom.getTime();
          const to = filterTo.getTime();
          return (started >= from && started <= to) || (resolved >= from && resolved <= to);
        })
      : cycleRows;
    const byAssignee = new Map<string, { responseMs: number[]; resolveMs: number[] }>();
    for (const r of filtered) {
      const aid = r.assignee_id ?? 'unassigned';
      if (!byAssignee.has(aid)) byAssignee.set(aid, { responseMs: [], resolveMs: [] });
      const entry = byAssignee.get(aid)!;
      if (r.first_response_at) {
        entry.responseMs.push(new Date(r.first_response_at).getTime() - new Date(r.cycle_started_at).getTime());
      }
      if (r.resolved_at) {
        entry.resolveMs.push(new Date(r.resolved_at).getTime() - new Date(r.cycle_started_at).getTime());
      }
    }
    for (const [aid, data] of byAssignee) {
      const avgResp = data.responseMs.length ? data.responseMs.reduce((a, b) => a + b, 0) / data.responseMs.length : 0;
      const avgRes = data.resolveMs.length ? data.resolveMs.reduce((a, b) => a + b, 0) / data.resolveMs.length : 0;
      map.set(aid, {
        avgResponseFormatted: data.responseMs.length ? formatDurationMs(avgResp) : '',
        avgResolveFormatted: data.resolveMs.length ? formatDurationMs(avgRes) : '',
      });
    }
    return map;
  })();

  // Source Performance Analysis with conversion tracking - use dynamic sources
  const sourcePerformanceAnalysis = uniqueSources.map(source => {
    const sourceLeads = leads.filter(lead => lead.source === source);
    const convertedSourceLeads = sourceLeads.filter(lead => isConvertedLead(lead));
    const conversionRate = sourceLeads.length > 0 ? convertedSourceLeads.length / sourceLeads.length * 100 : 0;
    const percentage = totalLeads > 0 ? sourceLeads.length / totalLeads * 100 : 0;
    return {
      source,
      totalLeads: sourceLeads.length,
      convertedLeads: convertedSourceLeads.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
      // Round to 1 decimal place
      percentage: Math.round(percentage)
    };
  }).filter(item => item.totalLeads > 0).sort((a, b) => b.conversionRate - a.conversionRate); // Sort by conversion rate descending

  // Generate PDF Report with error handling and loading state
  const generatePDFReport = async () => {
    try {
      setIsGeneratingPDF(true);

      // Validate data before generating PDF
      if (!leads || leads.length === 0) {
        alert('Tidak ada data lead untuk dibuat laporan PDF');
        return;
      }

      // Prepare comprehensive data for PDF including calculated metrics
      const pdfData = {
        leads,
        filters: filters || {},
        clientStatuses,
        clientProfiles,
        metrics: {
          completeDataCount,
          incompleteDataCount,
          noDataCount,
          hotProspectCount,
          warmProspectCount,
          coldProspectCount,
          sourceAnalysis,
          servicesAnalysis,
          locationAnalysis,
          statusAnalysis,
          employeeAnalysis
        }
      };

      // Call the PDF generator with proper data structure
      await generateLeadsPDF(pdfData);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Terjadi kesalahan saat membuat laporan PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  return <div className={`${outerSpacingClass} min-w-0 max-w-full`}>
      {/* Dropdown for different views - hidden on mobile when tab is controlled via drawer */}
      {!hideTabDropdown && (
      <div className="w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'source-performance' && 'Source Performance'}
              {activeTab === 'consultant-performance' && 'Consultant Performance'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full">
            <DropdownMenuItem onClick={() => setActiveTab('overview')}>
              Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('source-performance')}>
              Source Performance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('consultant-performance')}>
              Consultant Performance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      )}
        {activeTab === 'overview' && <div className={sectionSpacingClass}>
          {/* Conversion Metrics */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/5")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-blue" />
                Conversion Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-lg font-bold text-brand-red">{convertedCount}</div>
                  <div className="text-xs text-slate-600">
                    {filters?.dateRange?.from ? 'Conversion Deal Periode Ini' : 'Total Converted Leads'}
                  </div>
                </div>
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-lg font-bold text-brand-blue">{conversionRate.toFixed(1)}%</div>
                  <div className="text-xs text-slate-600">Conversion Rate</div>
                </div>
              </div>
              <div className="bg-white/70 rounded-lg border border-border p-3">
                <div className="text-center mb-2">
                  <div className="text-sm font-medium text-slate-800">{monthToDateConversions.length}</div>
                  <div className="text-xs text-slate-500">Month to Date Conversions</div>
                </div>
                {monthToDateConversions.length > 0 && (
                  <div className="space-y-1 mt-3 pt-2 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-600 mb-2">Conversion Details:</div>
                    {monthToDateConversions.map((lead, index) => (
                      <div key={lead.id} className="flex justify-between items-center text-xs rounded bg-brand-blue-soft p-2">
                        <div className="flex-1">
                          <div className="font-medium text-slate-700">{lead.client}</div>
                          <div className="text-slate-500">by {lead.assignee}</div>
                        </div>
                        <div className="font-medium text-brand-blue">
                          {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Date Range Info */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg border border-border p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  {filters?.dateRange?.from && filters?.dateRange?.to ? `${new Date(filters.dateRange.from).toLocaleDateString('en-US')} - ${new Date(filters.dateRange.to).toLocaleDateString('en-US')}` : 'All Data'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Report Period</div>
              </div>
            </CardContent>
          </Card>

          {/* Source Analysis */}
          {sourceAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/5")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-blue" />
                  Lead Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sourceAnalysis.map(source => <div key={source.source} className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                    <span className="text-sm text-slate-700">{source.source}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {source.count}
                      </Badge>
                      <span className="text-xs text-slate-500">{source.percentage}%</span>
                    </div>
                  </div>)}
              </CardContent>
            </Card>}

          {/* Data Overview */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-lg font-bold text-brand-blue">{completeDataCount}</div>
                  <div className="text-xs text-slate-600">Complete Data</div>
                </div>
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-lg font-bold text-brand-blue/70">{incompleteDataCount}</div>
                  <div className="text-xs text-slate-600">Incomplete Data</div>
                </div>
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-lg font-bold text-brand-red">{noDataCount}</div>
                  <div className="text-xs text-slate-600">No Data</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Analysis */}
          {servicesAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-blue" />
                  Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {servicesAnalysis.map((service, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                    <span className="text-sm text-slate-700">{service.service}</span>
                    <Badge variant="outline" className="text-xs">
                      {service.count}
                    </Badge>
                  </div>)}
              </CardContent>
            </Card>}

          {/* Category Analysis */}
          {categoryAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-blue-soft/60")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-blue" />
                  Category Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryAnalysis.map((category, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                    <span className="text-sm text-slate-700">{category.category}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {category.count}
                      </Badge>
                      <span className="text-xs text-slate-500">{category.percentage}%</span>
                    </div>
                  </div>)}
              </CardContent>
            </Card>}

          {/* Gender Distribution Analysis */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-blue" />
                Gender Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Laki-laki</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-brand-blue-soft text-brand-blue">
                    {genderAnalysis.male}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {totalLeads > 0 ? Math.round(genderAnalysis.male / totalLeads * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Perempuan</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-brand-red/10 text-brand-red">
                    {genderAnalysis.female}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {totalLeads > 0 ? Math.round(genderAnalysis.female / totalLeads * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Unknown</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">
                    {genderAnalysis.unknown}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {totalLeads > 0 ? Math.round(genderAnalysis.unknown / totalLeads * 100) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Location Analysis */}
          {enhancedLocationAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/10")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-blue" />
                  Location Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {enhancedLocationAnalysis.map((location, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                    <span className="text-sm text-slate-700">{location.location}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {location.count}
                      </Badge>
                      <span className="text-xs text-slate-500">{location.percentage}%</span>
                    </div>
                  </div>)}
              </CardContent>
            </Card>}

          {/* Priority Analysis */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-blue" />
                Priority Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Hot Prospect</span>
                <Badge variant="destructive" className="bg-brand-red/15 text-brand-red">
                  {hotProspectCount}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Warm Prospect</span>
                <Badge variant="outline" className="bg-brand-blue-soft text-brand-blue">
                  {warmProspectCount}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/70 rounded border border-border">
                <span className="text-sm text-slate-700">Cold Prospect</span>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  {coldProspectCount}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Employee Performance */}
          {employeeAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/5")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <User2 className="h-4 w-4 text-brand-blue" />
                  Employee Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isCycleMetricsError && organizationId && (
                  <div className="text-xs text-amber-600 py-2">Gagal memuat metrik siklus</div>
                )}
                {employeeAnalysis.map((employee, index) => {
                  const cycleMetrics = employee.employeeIds?.length
                    ? employee.employeeIds.map((id) => cycleMetricsByAssignee.get(id)).find(Boolean)
                    : cycleMetricsByAssignee.get(employee.employeeId);
                  return (
                    <div key={index} className="p-3 bg-white/70 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{employee.employee}</span>
                      <Badge variant="outline" className="text-xs">
                        {employee.conversionRate}%
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Conversion Rate</span>
                        <span>{employee.convertedLeads}/{employee.totalLeads}</span>
                      </div>
                      <Progress value={employee.conversionRate} className="h-2" />
                    </div>
                    {cycleMetrics && (cycleMetrics.avgResponseFormatted || cycleMetrics.avgResolveFormatted) && (
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        {cycleMetrics.avgResponseFormatted && (
                          <div>
                            <span className="text-slate-500">Avg response: </span>
                            <span className="font-medium">{cycleMetrics.avgResponseFormatted}</span>
                          </div>
                        )}
                        {cycleMetrics.avgResolveFormatted && (
                          <div>
                            <span className="text-slate-500">Avg resolve: </span>
                            <span className="font-medium">{cycleMetrics.avgResolveFormatted}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </CardContent>
            </Card>}

          {/* Status Analysis - Always displayed below Employee Performance */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-blue" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statusAnalysis.length > 0 ? (
                  statusAnalysis.map((status, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded border border-border">
                      <span className="text-sm text-slate-700">{getLeadStatusDisplayName(status.status)}</span>
                      <Badge variant="outline" className="text-xs">
                        {status.count}
                      </Badge>
                    </div>)
                ) : (
                  <div className="p-2 bg-white/70 rounded border border-border text-center">
                    <span className="text-sm text-slate-500">No status data available</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>}
        
        {activeTab === 'source-performance' && <div className={sectionSpacingClass}>
          {/* Source Performance Header */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <LineChart className="h-4 w-4 text-slate-600" />
                Source Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg border border-border p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  Lead generation and conversion performance by source
                </div>
                <div className="text-xs text-slate-500 mt-1">Sorted by conversion rate</div>
              </div>
            </CardContent>
          </Card>

          {/* Source Performance Analysis */}
          {sourcePerformanceAnalysis.length > 0 ? <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-blue" />
                  Source Conversion Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sourcePerformanceAnalysis.map((source, index) => <div key={source.source} className="p-3 bg-white/70 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{source.source}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {source.conversionRate}%
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {source.percentage}% of total
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Conversion Rate</span>
                        <span>{source.convertedLeads}/{source.totalLeads} converted</span>
                      </div>
                      <Progress value={source.conversionRate} className="h-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 rounded p-2">
                        <div className="font-semibold text-slate-700">{source.totalLeads}</div>
                        <div className="text-slate-500">Total Leads</div>
                      </div>
                      <div className="bg-brand-red/10 rounded p-2">
                        <div className="font-semibold text-brand-red">{source.convertedLeads}</div>
                        <div className="text-brand-red/90">Converted</div>
                      </div>
                      <div className="bg-brand-blue-soft rounded p-2">
                        <div className="font-semibold text-brand-blue">{source.conversionRate}%</div>
                        <div className="text-brand-blue/90">Success Rate</div>
                      </div>
                    </div>
                    
                    {/* FU Priority Performance for this source */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">FU Priority Performance</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-brand-red/10 rounded p-2">
                          <div className="font-semibold text-brand-red">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'High').length}
                          </div>
                          <div className="text-brand-red/90">High</div>
                        </div>
                        <div className="bg-brand-blue-soft rounded p-2">
                          <div className="font-semibold text-brand-blue">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'Medium').length}
                          </div>
                          <div className="text-brand-blue/90">Medium</div>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <div className="font-semibold text-muted-foreground">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'Low').length}
                          </div>
                          <div className="text-muted-foreground">Low</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Gender Distribution for this source */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Gender Distribution</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-brand-blue-soft rounded p-2">
                          <div className="font-semibold text-brand-blue">
                            {leads.filter(lead => lead.source === source.source && getGenderFromProfile(lead.id) === 'Male').length}
                          </div>
                          <div className="text-brand-blue/90">Laki-laki</div>
                        </div>
                        <div className="bg-brand-red/10 rounded p-2">
                          <div className="font-semibold text-brand-red">
                            {leads.filter(lead => lead.source === source.source && getGenderFromProfile(lead.id) === 'Female').length}
                          </div>
                          <div className="text-brand-red/90">Perempuan</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="font-semibold text-gray-600">
                            {leads.filter(lead => lead.source === source.source && getGenderFromProfile(lead.id) === 'Unknown').length}
                          </div>
                          <div className="text-gray-500">Unknown</div>
                        </div>
                      </div>
                    </div>

                    {/* Location Distribution for this source */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Location Distribution</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => lead.source === source.source).map(lead => getLocationFromProfile(lead.id)))].map(location => <div key={location} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{location}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => lead.source === source.source && getLocationFromProfile(lead.id) === location).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>

                    {/* Services for this source */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Services Distribution</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => lead.source === source.source && lead.services).map(lead => lead.services))].map(service => <div key={service} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{service}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => lead.source === source.source && lead.services === service).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>
                  </div>)}
              </CardContent>
            </Card> : <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-gray-50 to-slate-50")}>
              <CardContent className="p-6 text-center">
                <div className="text-sm text-slate-600">No source performance data available</div>
                <div className="text-xs text-slate-500 mt-1">Data will appear when leads have assigned sources</div>
              </CardContent>
            </Card>}

          {/* Top performing source highlight */}
          {sourcePerformanceAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/10")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="h-4 w-4 text-brand-blue" />
                  Best Performing Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-800">{sourcePerformanceAnalysis[0].source}</div>
                    <div className="text-sm text-slate-600">
                      {sourcePerformanceAnalysis[0].conversionRate}% conversion rate
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {sourcePerformanceAnalysis[0].convertedLeads} out of {sourcePerformanceAnalysis[0].totalLeads} leads converted
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>}
          </div>}
        
        {activeTab === 'consultant-performance' && <div className={sectionSpacingClass}>
          {/* Consultant Performance Header */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <User2 className="h-4 w-4 text-slate-600" />
                Sales Consultant Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg border border-border p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  Individual consultant performance metrics and analytics
                </div>
                <div className="text-xs text-slate-500 mt-1">Sorted by conversion rate</div>
                <div className="text-xs text-slate-500 mt-1">All agents with total chats/leads handled. Based on current filters.</div>
              </div>
            </CardContent>
          </Card>

          {/* Consultant Performance Analysis */}
          {employeeAnalysis.length > 0 ? <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/5")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-blue" />
                  Consultant Performance Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {employeeAnalysis.map((consultant, index) => {
                  const isConsultantLead = (lead: NewLead) =>
                    lead.assignee === consultant.employee || (leadAssigneeId(lead) && consultant.employeeIds.includes(leadAssigneeId(lead)!));
                  return <div key={consultant.employeeId} className="p-3 bg-white/70 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{consultant.employee}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${consultant.conversionRate >= 50 ? 'bg-brand-blue-soft text-brand-blue' : consultant.conversionRate >= 25 ? 'bg-brand-red/10 text-brand-red' : 'bg-muted text-muted-foreground'}`}>
                          {consultant.conversionRate}%
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          #{index + 1} Rank
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Conversion Rate</span>
                        <span>{consultant.convertedLeads}/{consultant.totalLeads} converted</span>
                      </div>
                      <Progress value={consultant.conversionRate} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                      <div className="bg-slate-50 rounded p-2">
                        <div className="font-semibold text-slate-700">{consultant.totalLeads}</div>
                        <div className="text-slate-500">Total Chats/Leads</div>
                      </div>
                      <div className="bg-brand-blue-soft rounded p-2">
                        <div className="font-semibold text-brand-blue">{consultant.activeLeads}</div>
                        <div className="text-brand-blue/90">In Progress</div>
                      </div>
                      <div className="bg-brand-red/10 rounded p-2">
                        <div className="font-semibold text-brand-red">{consultant.convertedLeads}</div>
                        <div className="text-brand-red/90">Converted</div>
                      </div>
                      <div className="bg-muted rounded p-2">
                        <div className="font-semibold text-muted-foreground">{consultant.totalLeads - consultant.convertedLeads}</div>
                        <div className="text-muted-foreground">Not Converted</div>
                      </div>
                    </div>
                    
                     {/* Conversion Deal Periode Ini */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Conversion Deal Periode Ini</div>
                      <div className="p-3 bg-white/70 rounded-lg border border-border space-y-2">
                        <div className="text-center">
                           <div className="text-lg font-bold text-brand-red">
                             {(() => {
                                // Get converted leads for this consultant (match by name or assignee_id)
                                const consultantLeads = leads.filter(lead => isConsultantLead(lead) && isConvertedLead(lead));
                               
                               // If there's a date range filter, check against converted_at
                               if (filters?.dateRange?.from && filters?.dateRange?.to) {
                                 const fromDate = new Date(filters.dateRange.from);
                                 const toDate = new Date(filters.dateRange.to);
                                 
                                 // Set time boundaries
                                 fromDate.setHours(0, 0, 0, 0);
                                 toDate.setHours(23, 59, 59, 999);
                                 
                                 const conversionsInPeriod = consultantLeads.filter(lead => {
                                   if (!lead.converted_at) return false;
                                   const convertedDate = new Date(lead.converted_at);
                                   return convertedDate >= fromDate && convertedDate <= toDate;
                                 });
                                 
                                 return conversionsInPeriod.length;
                               }
                               
                               return consultantLeads.length; // Show all conversions if no date filter
                             })()}
                           </div>
                          <div className="text-xs text-slate-600">
                            {filters?.dateRange?.from && filters?.dateRange?.to 
                              ? 'Deals Resolved in Period' 
                              : 'Total Deals Resolved'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FU Priority for this consultant */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">FU Priority Distribution</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-brand-red/10 rounded p-2">
                          <div className="font-semibold text-brand-red">
                            {leads.filter(lead => isConsultantLead(lead) && lead.fu_priority === 'High').length}
                          </div>
                          <div className="text-brand-red/90">High</div>
                        </div>
                        <div className="bg-brand-blue-soft rounded p-2">
                          <div className="font-semibold text-brand-blue">
                            {leads.filter(lead => isConsultantLead(lead) && lead.fu_priority === 'Medium').length}
                          </div>
                          <div className="text-brand-blue/90">Medium</div>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <div className="font-semibold text-muted-foreground">
                            {leads.filter(lead => isConsultantLead(lead) && lead.fu_priority === 'Low').length}
                          </div>
                          <div className="text-muted-foreground">Low</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Services handled by this consultant */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Services Handled</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => isConsultantLead(lead) && lead.services).map(lead => lead.services))].map(service => <div key={service} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{service}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => isConsultantLead(lead) && lead.services === service).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>
                    
                    {/* Source breakdown for this consultant */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Lead Sources</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => isConsultantLead(lead) && lead.source).map(lead => lead.source))].map(source => <div key={source} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{source}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => isConsultantLead(lead) && lead.source === source).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>
                  </div>;
                })}
              </CardContent>
            </Card> : <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-gray-50 to-slate-50")}>
              <CardContent className="p-6 text-center">
                <div className="text-sm text-slate-600">No consultant performance data available</div>
                <div className="text-xs text-slate-500 mt-1">Data will appear when leads have assigned consultants</div>
              </CardContent>
            </Card>}

          {/* Top performing consultant highlight */}
          {employeeAnalysis.length > 0 && <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-red/10")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="h-4 w-4 text-brand-blue" />
                  Top Performing Consultant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/70 rounded-lg border border-border p-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-800">{employeeAnalysis[0].employee}</div>
                    <div className="text-sm text-slate-600">
                      {employeeAnalysis[0].conversionRate}% conversion rate
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {employeeAnalysis[0].convertedLeads} out of {employeeAnalysis[0].totalLeads} leads converted
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>}

          {/* Overall consultant statistics */}
          <Card className={sectionCardClass("border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-background")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                Team Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/70 rounded-lg border border-border p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{employeeAnalysis.length}</div>
                  <div className="text-xs text-slate-600">Active Consultants</div>
                </div>
                <div className="bg-white/70 rounded-lg border border-border p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">
                    {employeeAnalysis.length > 0 ? Math.round(employeeAnalysis.reduce((sum, emp) => sum + emp.conversionRate, 0) / employeeAnalysis.length) : 0}%
                  </div>
                  <div className="text-xs text-slate-600">Average Conversion Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>}
    </div>;
};
