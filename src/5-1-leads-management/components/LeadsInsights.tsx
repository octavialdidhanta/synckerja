import React, { useState, useEffect } from 'react';
import { NewLead } from '@/shared/types/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { TrendingUp, Users, Calendar, Target, Download, FileText, BarChart3, MapPin, Loader2, User2, LineChart, ChevronDown } from 'lucide-react';
import { generateLeadsPDF } from './LeadsPDFGenerator';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';
import { supabase } from '@/shared/lib/supabaseClient';
import { LeadStatusHistoryEntry } from '@/shared/hooks/organized/sales';
interface LeadsInsightsProps {
  leads: NewLead[];
  filters?: any;
  clientStatuses?: Record<string, 'full' | 'partial' | 'empty'>;
  clientProfiles?: Record<string, any>;
}
export const LeadsInsights = ({
  leads,
  filters,
  clientStatuses = {},
  clientProfiles = {}
}: LeadsInsightsProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Debug: Log the input data (only once per render)
  React.useEffect(() => {
    console.log('=== LeadsInsights Debug ===');
    console.log('Total leads:', leads.length);
    console.log('Filters:', filters);
    console.log('Date range filter:', filters?.dateRange);
    console.log('Client profiles keys:', Object.keys(clientProfiles));
    console.log('Lead IDs:', leads.map(lead => lead.id));
    console.log('==========================');
  }, [leads.length, Object.keys(clientProfiles).length, filters?.dateRange]);
  const totalLeads = leads.length;

  // Calculate conversion metrics with proper date filtering
  const convertedLeads = leads.filter(lead => lead.lead_status?.name === 'Converted');
  
  // Calculate "Conversion Deal Periode Ini" based on date filters and lead converted_at field
  const calculateConversionDealPeriode = () => {
    if (!filters?.dateRange?.from || !filters?.dateRange?.to) {
      // No date filter - use all converted leads
      console.log('📊 No date filter - using all converted leads:', convertedLeads.length);
      return convertedLeads.length;
    }

    // Convert filter dates to Date objects and normalize to start/end of day
    const filterFrom = new Date(filters.dateRange.from);
    filterFrom.setHours(0, 0, 0, 0);
    
    const filterTo = new Date(filters.dateRange.to);
    filterTo.setHours(23, 59, 59, 999);

    console.log('📊 Date filter applied:', {
      from: filterFrom.toISOString(),
      to: filterTo.toISOString()
    });

    // Use converted_at field from leads instead of status history to avoid duplicates
    const conversionsInPeriod = convertedLeads.filter(lead => {
      if (!lead.converted_at) return false;
      
      const convertedDate = new Date(lead.converted_at);
      const isInRange = convertedDate >= filterFrom && convertedDate <= filterTo;
      
      return isInRange;
    });

    console.log('📊 Leads converted in period:', conversionsInPeriod.length);
    console.log('📊 Converted lead IDs in period:', conversionsInPeriod.map(l => l.id));
    
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
    
    // Set today to end of day for proper comparison
    const endOfToday = new Date(year, month, today.getDate(), 23, 59, 59, 999);
    
    console.log('📊 Month-to-Date calculation (independent of filters):', {
      today: today.toISOString(),
      year,
      month: month + 1, // Display as 1-based month
      firstDayOfMonth: firstDayOfMonth.toISOString(),
      endOfToday: endOfToday.toISOString(),
      firstDayLocal: firstDayOfMonth.toLocaleDateString('id-ID'),
      endOfTodayLocal: endOfToday.toLocaleDateString('id-ID')
    });
    
    console.log('📊 All converted leads data:', convertedLeads.map(lead => ({
      id: lead.id,
      status: lead.lead_status?.name,
      converted_at: lead.converted_at,
      created_at: lead.created_at,
      updated_at: lead.updated_at
    })));
    
    const filteredConversions = convertedLeads.filter(lead => {
      if (!lead.converted_at) {
        console.log('📊 Lead without converted_at:', lead.id);
        return false;
      }
      
      const convertedDate = new Date(lead.converted_at);
      const isInRange = convertedDate >= firstDayOfMonth && convertedDate <= endOfToday;
      
      console.log('📊 Checking lead conversion:', {
        leadId: lead.id,
        convertedAt: lead.converted_at,
        convertedDate: convertedDate.toISOString(),
        convertedDateLocal: convertedDate.toLocaleDateString('id-ID'),
        firstDayOfMonth: firstDayOfMonth.toISOString(),
        endOfToday: endOfToday.toISOString(),
        isInRange
      });
      
      return isInRange;
    });
    
    console.log('📊 Month-to-Date filtered conversions:', filteredConversions.length);
    console.log('📊 Filtered conversion IDs:', filteredConversions.map(l => l.id));
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

  // Status analysis
  const statusAnalysis = [...new Set(leads.map(lead => lead.lead_status?.name).filter(Boolean))].map(status => {
    const statusLeads = leads.filter(lead => lead.lead_status?.name === status);
    return {
      status: status || 'Not Specified',
      count: statusLeads.length
    };
  });

  // Employee performance analysis with conversion tracking
  const employeeAnalysis = [...new Set(leads.map(lead => lead.assignee).filter(Boolean))].map(assignee => {
    const assigneeLeads = leads.filter(lead => lead.assignee === assignee);
    const convertedLeads = assigneeLeads.filter(lead => lead.lead_status?.name === 'Converted');
    const conversionRate = assigneeLeads.length > 0 ? convertedLeads.length / assigneeLeads.length * 100 : 0;
    return {
      employee: assignee || 'Unassigned',
      totalLeads: assigneeLeads.length,
      convertedLeads: convertedLeads.length,
      conversionRate: Math.round(conversionRate * 10) / 10 // Round to 1 decimal place
    };
  }).sort((a, b) => b.conversionRate - a.conversionRate); // Sort by conversion rate descending

  // Source Performance Analysis with conversion tracking - use dynamic sources
  const sourcePerformanceAnalysis = uniqueSources.map(source => {
    const sourceLeads = leads.filter(lead => lead.source === source);
    const convertedSourceLeads = sourceLeads.filter(lead => lead.lead_status?.name === 'Converted');
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
      console.log('✅ PDF generated successfully');
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Terjadi kesalahan saat membuat laporan PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  return <div className="space-y-4">
      {/* Header with Download Button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Report Summary</h3>
          <p className="text-sm text-slate-500">Data summary based on filters</p>
        </div>
        <Button onClick={generatePDFReport} disabled={isGeneratingPDF} size="sm" className="disabled:cursor-not-allowed">
          {isGeneratingPDF ? <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </> : <>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </>}
        </Button>
      </div>

      {/* Dropdown for different views */}
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
        
        {activeTab === 'overview' && <div className="space-y-3 mt-4">
          {/* Conversion Metrics */}
          <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50 to-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Conversion Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/70 rounded-lg p-3">
                  <div className="text-lg font-bold text-emerald-600">{convertedCount}</div>
                  <div className="text-xs text-slate-600">
                    {filters?.dateRange?.from ? 'Conversion Deal Periode Ini' : 'Total Converted Leads'}
                  </div>
                </div>
                <div className="bg-white/70 rounded-lg p-3">
                  <div className="text-lg font-bold text-brand-blue">{conversionRate.toFixed(1)}%</div>
                  <div className="text-xs text-slate-600">Conversion Rate</div>
                </div>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <div className="text-center mb-2">
                  <div className="text-sm font-medium text-slate-800">{monthToDateConversions.length}</div>
                  <div className="text-xs text-slate-500">Month to Date Conversions</div>
                </div>
                {monthToDateConversions.length > 0 && (
                  <div className="space-y-1 mt-3 pt-2 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-600 mb-2">Conversion Details:</div>
                    {monthToDateConversions.map((lead, index) => (
                      <div key={lead.id} className="flex justify-between items-center text-xs bg-emerald-50 rounded p-2">
                        <div className="flex-1">
                          <div className="font-medium text-slate-700">{lead.client}</div>
                          <div className="text-slate-500">by {lead.assignee}</div>
                        </div>
                        <div className="text-emerald-600 font-medium">
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
          <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  {filters?.dateRange?.from && filters?.dateRange?.to ? `${new Date(filters.dateRange.from).toLocaleDateString('en-US')} - ${new Date(filters.dateRange.to).toLocaleDateString('en-US')}` : 'All Data'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Report Period</div>
              </div>
            </CardContent>
          </Card>

          {/* Source Analysis */}
          {sourceAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-purple-50 to-pink-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  Lead Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sourceAnalysis.map(source => <div key={source.source} className="flex items-center justify-between p-2 bg-white/70 rounded">
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
          <Card className="border-none shadow-sm bg-gradient-to-r from-brand-blue-soft to-brand-blue-soft/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/70 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-600">{completeDataCount}</div>
                  <div className="text-xs text-slate-600">Complete Data</div>
                </div>
                <div className="bg-white/70 rounded-lg p-3">
                  <div className="text-lg font-bold text-orange-600">{incompleteDataCount}</div>
                  <div className="text-xs text-slate-600">Incomplete Data</div>
                </div>
                <div className="bg-white/70 rounded-lg p-3">
                  <div className="text-lg font-bold text-red-600">{noDataCount}</div>
                  <div className="text-xs text-slate-600">No Data</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Analysis */}
          {servicesAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {servicesAnalysis.map((service, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded">
                    <span className="text-sm text-slate-700">{service.service}</span>
                    <Badge variant="outline" className="text-xs">
                      {service.count}
                    </Badge>
                  </div>)}
              </CardContent>
            </Card>}

          {/* Location Analysis */}
          {locationAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-orange-50 to-red-50">
              
              
            </Card>}

          {/* Category Analysis */}
          {categoryAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-brand-blue-soft/80 to-brand-blue-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Category Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryAnalysis.map((category, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded">
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
          <Card className="border-none shadow-sm bg-gradient-to-r from-pink-50 to-rose-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-pink-600" />
                Gender Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white/70 rounded">
                <span className="text-sm text-slate-700">Laki-laki</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-brand-blue-soft text-brand-blue-deep">
                    {genderAnalysis.male}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {totalLeads > 0 ? Math.round(genderAnalysis.male / totalLeads * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/70 rounded">
                <span className="text-sm text-slate-700">Perempuan</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-pink-100 text-pink-700">
                    {genderAnalysis.female}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {totalLeads > 0 ? Math.round(genderAnalysis.female / totalLeads * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/70 rounded">
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
          {enhancedLocationAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-orange-50 to-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  Location Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {enhancedLocationAnalysis.map((location, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded">
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
          <Card className="border-none shadow-sm bg-gradient-to-r from-green-50 to-emerald-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                Priority Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-white/70 rounded">
                <span className="text-sm text-slate-700">Hot Prospect</span>
                <Badge variant="destructive" className="bg-red-100 text-red-700">
                  {hotProspectCount}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/70 rounded">
                <span className="text-sm text-slate-700">Warm Prospect</span>
                <Badge variant="outline" className="bg-orange-100 text-orange-700">
                  {warmProspectCount}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/70 rounded">
                <span className="text-sm text-slate-700">Cold Prospect</span>
                <Badge variant="secondary" className="bg-brand-blue-soft text-brand-blue-deep">
                  {coldProspectCount}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Employee Performance */}
          {employeeAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-violet-50 to-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <User2 className="h-4 w-4 text-violet-600" />
                  Employee Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {employeeAnalysis.map((employee, index) => <div key={index} className="p-3 bg-white/70 rounded-lg space-y-2">
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
                  </div>)}
              </CardContent>
            </Card>}

          {/* Status Analysis */}
          {statusAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statusAnalysis.map((status, index) => <div key={index} className="flex items-center justify-between p-2 bg-white/70 rounded">
                    <span className="text-sm text-slate-700">{getLeadStatusDisplayName(status.status)}</span>
                    <Badge variant="outline" className="text-xs">
                      {status.count}
                    </Badge>
                  </div>)}
              </CardContent>
            </Card>}
          </div>}
        
        {activeTab === 'source-performance' && <div className="space-y-3 mt-4">
          {/* Source Performance Header */}
          <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <LineChart className="h-4 w-4 text-slate-600" />
                Source Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  Lead generation and conversion performance by source
                </div>
                <div className="text-xs text-slate-500 mt-1">Sorted by conversion rate</div>
              </div>
            </CardContent>
          </Card>

          {/* Source Performance Analysis */}
          {sourcePerformanceAnalysis.length > 0 ? <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Source Conversion Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sourcePerformanceAnalysis.map((source, index) => <div key={source.source} className="p-3 bg-white/70 rounded-lg space-y-2">
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
                      <div className="bg-green-50 rounded p-2">
                        <div className="font-semibold text-green-700">{source.convertedLeads}</div>
                        <div className="text-green-600">Converted</div>
                      </div>
                      <div className="bg-brand-blue-soft rounded p-2">
                        <div className="font-semibold text-brand-blue-deep">{source.conversionRate}%</div>
                        <div className="text-brand-blue">Success Rate</div>
                      </div>
                    </div>
                    
                    {/* FU Priority Performance for this source */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">FU Priority Performance</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-red-50 rounded p-2">
                          <div className="font-semibold text-red-600">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'High').length}
                          </div>
                          <div className="text-red-500">High</div>
                        </div>
                        <div className="bg-orange-50 rounded p-2">
                          <div className="font-semibold text-orange-600">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'Medium').length}
                          </div>
                          <div className="text-orange-500">Medium</div>
                        </div>
                        <div className="bg-brand-blue-soft rounded p-2">
                          <div className="font-semibold text-brand-blue">
                            {leads.filter(lead => lead.source === source.source && lead.fu_priority === 'Low').length}
                          </div>
                          <div className="text-brand-blue">Low</div>
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
                          <div className="text-brand-blue">Laki-laki</div>
                        </div>
                        <div className="bg-pink-50 rounded p-2">
                          <div className="font-semibold text-pink-600">
                            {leads.filter(lead => lead.source === source.source && getGenderFromProfile(lead.id) === 'Female').length}
                          </div>
                          <div className="text-pink-500">Perempuan</div>
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
            </Card> : <Card className="border-none shadow-sm bg-gradient-to-r from-gray-50 to-slate-50">
              <CardContent className="p-6 text-center">
                <div className="text-sm text-slate-600">No source performance data available</div>
                <div className="text-xs text-slate-500 mt-1">Data will appear when leads have assigned sources</div>
              </CardContent>
            </Card>}

          {/* Top performing source highlight */}
          {sourcePerformanceAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="h-4 w-4 text-yellow-600" />
                  Best Performing Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/70 rounded-lg p-3">
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
        
        {activeTab === 'consultant-performance' && <div className="space-y-3 mt-4">
          {/* Consultant Performance Header */}
          <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <User2 className="h-4 w-4 text-slate-600" />
                Sales Consultant Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg p-3 text-center">
                <div className="text-sm font-medium text-slate-800">
                  Individual consultant performance metrics and analytics
                </div>
                <div className="text-xs text-slate-500 mt-1">Sorted by conversion rate</div>
              </div>
            </CardContent>
          </Card>

          {/* Consultant Performance Analysis */}
          {employeeAnalysis.length > 0 ? <Card className="border-none shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Consultant Performance Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {employeeAnalysis.map((consultant, index) => <div key={consultant.employee} className="p-3 bg-white/70 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{consultant.employee}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${consultant.conversionRate >= 50 ? 'bg-green-100 text-green-700' : consultant.conversionRate >= 25 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
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
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 rounded p-2">
                        <div className="font-semibold text-slate-700">{consultant.totalLeads}</div>
                        <div className="text-slate-500">Total Leads</div>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <div className="font-semibold text-green-700">{consultant.convertedLeads}</div>
                        <div className="text-green-600">Converted</div>
                      </div>
                      <div className="bg-red-50 rounded p-2">
                        <div className="font-semibold text-red-700">{consultant.totalLeads - consultant.convertedLeads}</div>
                        <div className="text-red-600">Not Converted</div>
                      </div>
                    </div>
                    
                     {/* Conversion Deal Periode Ini */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Conversion Deal Periode Ini</div>
                      <div className="p-3 bg-white/70 rounded-lg space-y-2">
                        <div className="text-center">
                           <div className="text-lg font-bold text-emerald-600">
                             {(() => {
                                // Get converted leads for this consultant
                                const consultantLeads = leads.filter(lead => 
                                  lead.assignee === consultant.employee && lead.lead_status?.name === 'Converted'
                                );
                               
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
                        <div className="bg-red-50 rounded p-2">
                          <div className="font-semibold text-red-600">
                            {leads.filter(lead => lead.assignee === consultant.employee && lead.fu_priority === 'High').length}
                          </div>
                          <div className="text-red-500">High</div>
                        </div>
                        <div className="bg-orange-50 rounded p-2">
                          <div className="font-semibold text-orange-600">
                            {leads.filter(lead => lead.assignee === consultant.employee && lead.fu_priority === 'Medium').length}
                          </div>
                          <div className="text-orange-500">Medium</div>
                        </div>
                        <div className="bg-brand-blue-soft rounded p-2">
                          <div className="font-semibold text-brand-blue">
                            {leads.filter(lead => lead.assignee === consultant.employee && lead.fu_priority === 'Low').length}
                          </div>
                          <div className="text-brand-blue">Low</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Services handled by this consultant */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Services Handled</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => lead.assignee === consultant.employee && lead.services).map(lead => lead.services))].map(service => <div key={service} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{service}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => lead.assignee === consultant.employee && lead.services === service).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>
                    
                    {/* Source breakdown for this consultant */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-600 mb-2">Lead Sources</div>
                      <div className="space-y-1">
                        {[...new Set(leads.filter(lead => lead.assignee === consultant.employee && lead.source).map(lead => lead.source))].map(source => <div key={source} className="flex justify-between items-center bg-slate-50 rounded px-2 py-1">
                            <span className="text-xs text-slate-600">{source}</span>
                            <Badge variant="outline" className="text-xs">
                              {leads.filter(lead => lead.assignee === consultant.employee && lead.source === source).length}
                            </Badge>
                          </div>)}
                      </div>
                    </div>
                  </div>)}
              </CardContent>
            </Card> : <Card className="border-none shadow-sm bg-gradient-to-r from-gray-50 to-slate-50">
              <CardContent className="p-6 text-center">
                <div className="text-sm text-slate-600">No consultant performance data available</div>
                <div className="text-xs text-slate-500 mt-1">Data will appear when leads have assigned consultants</div>
              </CardContent>
            </Card>}

          {/* Top performing consultant highlight */}
          {employeeAnalysis.length > 0 && <Card className="border-none shadow-sm bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="h-4 w-4 text-yellow-600" />
                  Top Performing Consultant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/70 rounded-lg p-3">
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
          <Card className="border-none shadow-sm bg-gradient-to-r from-teal-50 to-cyan-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-teal-600" />
                Team Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{employeeAnalysis.length}</div>
                  <div className="text-xs text-slate-600">Active Consultants</div>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">
                    {employeeAnalysis.length > 0 ? Math.round(employeeAnalysis.reduce((sum, emp) => sum + emp.conversionRate, 0) / employeeAnalysis.length) : 0}%
                  </div>
                  <div className="text-xs text-slate-600">Average Conversion Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>}
      </div>
    </div>;
};

