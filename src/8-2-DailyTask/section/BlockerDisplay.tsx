import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  AlertTriangle, 
  Calendar, 
  User, 
  Clock, 
  ChevronRight,
  Filter,
  X,
  Target
} from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { BlockerResolutionModal } from '@/8-2-DailyTaskReport/components/BlockerResolutionModal';

interface Blocker {
  id: string;
  task_step_id: string;
  description: string;
  blocker_type: string;
  blocker_severity: string;
  created_at: string;
  created_by: string;
  created_by_employee?: { id: string; full_name: string; email?: string };
  step_title: string;
  task_title: string;
  objective_id: string;
  is_resolved?: boolean;
}

interface BlockerDisplayProps {
  weekStart: string; // Format: "2025-10-24"
  weekEnd: string;   // Format: "2025-10-30"
  organizationId: string;
  objectiveId?: string; // Optional objective ID filter
  objectiveType?: 'individual' | 'department' | 'company'; // Type of objective
  onBlockerUpdate?: () => void;
}

export const BlockerDisplay: React.FC<BlockerDisplayProps> = ({
  weekStart,
  weekEnd,
  organizationId,
  objectiveId,
  objectiveType = 'individual',
  onBlockerUpdate
}) => {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filteredBlockers, setFilteredBlockers] = useState<Blocker[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [objectiveInfo, setObjectiveInfo] = useState<Record<string, { title: string; type: 'department' | 'individual' }>>({});
  const [tab, setTab] = useState<'list' | 'resolved'>('list');
  const [resolutionFor, setResolutionFor] = useState<Blocker | null>(null);
  const [resolvedRows, setResolvedRows] = useState<Array<{ id: string; task_step_history_id: string; description: string; created_at: string; blocker_description?: string; taskTitle?: string; stepTitle?: string }>>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [blockerCount, setBlockerCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  
  const { toast } = useToast();
  
  // Cache key for this specific query
  const cacheKey = `blockers_${organizationId}_${objectiveId}_${objectiveType}_${weekStart}_${weekEnd}`;

  const fetchBlockers = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let blockersData = null;
      let error = null;

      // Use different RPC function based on objective type
      if (objectiveType === 'department' && objectiveId) {
        // For department objectives, get blockers from all related individual objectives
        const result = await (supabase as any).rpc('get_blockers_for_department_objective', {
          p_organization_id: organizationId,
          p_week_start: `${weekStart}T00:00:00.000Z`,
          p_week_end: `${weekEnd}T23:59:59.999Z`,
          p_department_objective_id: objectiveId,
          p_limit: 100
        });
        blockersData = result.data;
        error = result.error;
      } else {
        // For individual/company objectives or no objective filter
        const result = await (supabase as any).rpc('get_blockers_for_period', {
          p_organization_id: organizationId,
          p_week_start: `${weekStart}T00:00:00.000Z`,
          p_week_end: `${weekEnd}T23:59:59.999Z`,
          p_objective_id: objectiveId || null,
          p_limit: 100
        });
        blockersData = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error fetching blockers via RPC:', error);
        throw error;
      }

      console.log(`🔍 Blockers fetched via efficient RPC function (${objectiveType}):`, blockersData);

      // Blockers are already filtered by organization and objective in the database function
      if (!blockersData || blockersData.length === 0) {
        setBlockers([]);
        setLoading(false);
        return;
      }

      const stepIds = [...new Set(blockersData.map((b: any) => b.task_step_id).filter(Boolean))];
      
      // Fetch task steps with tasks in separate query (simpler join)
      const { data: stepsData } = await supabase
        .from('task_steps')
        .select('id, title, task_id, daily_tasks!inner(id, title, organization_id, objective_id)')
        .in('id', stepIds)
        .eq('daily_tasks.organization_id', organizationId);

      console.log('🔍 Fetched steps data:', stepsData?.length || 0);

      // Create step mapping for quick lookup
      const stepMap: Record<string, any> = {};
      (stepsData || []).forEach((s: any) => {
        stepMap[s.id] = s;
      });

      // Get unique user IDs from filtered blockers
      const userIds = [...new Set(filteredBlockers.map((blocker: any) => blocker.created_by).filter(Boolean))];
      
      // Fetch employee data for these user IDs
      let employeesData = {};
      if (userIds.length > 0) {
        const { data: employees, error: empError } = await (supabase as any)
          .from('employees')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (empError) {
          console.warn('Failed to fetch employees:', empError);
        } else {
          employeesData = employees?.reduce((acc: any, emp: any) => {
            acc[emp.user_id] = emp;
            return acc;
          }, {}) || {};
        }
      }

      console.log('🔍 Employees data:', employeesData);

      // Map blocker data with step and task information
      const formattedBlockers = blockersData.map((blocker: any) => {
        const step = stepMap[blocker.task_step_id];
        const task = step?.daily_tasks;
        
        return {
          id: blocker.id,
          task_step_id: blocker.task_step_id,
          description: blocker.description,
          blocker_type: blocker.blocker_type,
          blocker_severity: blocker.blocker_severity,
          created_at: blocker.created_at,
          created_by: blocker.created_by,
          created_by_employee: employeesData[blocker.created_by] || null,
          step_title: step?.title || 'Unknown Step',
          task_title: task?.title || 'Unknown Task',
          objective_id: task?.objective_id || null,
          is_resolved: blocker.is_resolved || false
        };
      });

      console.log('🔍 Formatted blockers:', formattedBlockers);

      // Fetch objective information for all unique objective IDs
      const uniqueObjectiveIds = [...new Set(formattedBlockers.map(blocker => blocker.objective_id))];
      const objectiveInfoMap: Record<string, { title: string; type: 'department' | 'individual' }> = {};
      
      for (const objId of uniqueObjectiveIds) {
        if (!objId || objId === 'Unknown Objective') continue;
        
        try {
          // Check if it's a department objective (use maybeSingle to avoid 406 errors)
          const { data: deptObj, error: deptError } = await (supabase as any)
            .from('department_objectives')
            .select('id, title')
            .eq('id', objId)
            .maybeSingle();
          
          if (!deptError && deptObj) {
            objectiveInfoMap[objId] = { title: deptObj.title, type: 'department' };
          } else {
            // Check if it's an individual objective (use maybeSingle to avoid 406 errors)
            const { data: indObj, error: indError } = await (supabase as any)
              .from('individual_objectives')
              .select('id, title')
              .eq('id', objId)
              .maybeSingle();
            
            if (!indError && indObj) {
              objectiveInfoMap[objId] = { title: indObj.title, type: 'individual' };
            }
          }
        } catch (err) {
          console.warn(`⚠️ Error fetching objective info for ${objId}:`, err);
          // Continue with other objectives
        }
      }
      
      setObjectiveInfo(objectiveInfoMap);
      setBlockers(formattedBlockers);
    } catch (error: any) {
      console.error('Error fetching blockers:', error);
      
      // Graceful degradation for timeout errors (don't show toast, just log)
      const isTimeout = error.message?.includes('timeout') || error.code === '57014';
      
      if (isTimeout) {
        console.warn('⚠️ Blocker query timeout - using empty results for graceful degradation');
        setBlockers([]);
      } else {
        // Only show toast for non-timeout errors
        toast({
          title: 'Error',
          description: `Failed to fetch blockers: ${error.message}`,
          variant: 'destructive',
        });
        setBlockers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch blocker COUNT on mount (lightweight query)
  // This shows the badge count without loading full data
  const fetchBlockerCount = async () => {
    if (!organizationId) return;
    
    setCountLoading(true);
    try {
      let count = 0;
      let error = null;

      // Use different RPC function based on objective type
      if (objectiveType === 'department' && objectiveId) {
        // For department objectives, get blockers from all related individual objectives
        const result = await (supabase as any).rpc('get_blocker_count_for_department_objective', {
          p_organization_id: organizationId,
          p_week_start: `${weekStart}T00:00:00.000Z`,
          p_week_end: `${weekEnd}T23:59:59.999Z`,
          p_department_objective_id: objectiveId
        });
        count = result.data;
        error = result.error;
      } else {
        // For individual/company objectives or no objective filter
        const result = await (supabase as any).rpc('get_blocker_count_for_period', {
          p_organization_id: organizationId,
          p_week_start: `${weekStart}T00:00:00.000Z`,
          p_week_end: `${weekEnd}T23:59:59.999Z`,
          p_objective_id: objectiveId || null
        });
        count = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ Error fetching blocker count:', error);
        setBlockerCount(null);
      } else {
        setBlockerCount(count || 0);
        console.log(`✅ Blocker count loaded (${objectiveType}):`, {
          count,
          weekStart,
          weekEnd,
          objectiveId,
          organizationId
        });
      }
    } catch (error) {
      console.error('Error in fetchBlockerCount:', error);
      setBlockerCount(null);
    } finally {
      setCountLoading(false);
    }
  };

  // Auto-fetch COUNT on mount (lightweight)
  useEffect(() => {
    console.log('🔄 BlockerDisplay mounted:', { 
      weekStart, 
      weekEnd, 
      organizationId, 
      objectiveId, 
      objectiveType 
    });
    fetchBlockerCount();
    setHasInitialLoad(false);
  }, [weekStart, weekEnd, organizationId, objectiveId, objectiveType]);

  // Manual fetch triggered by user action (full data)
  const handleShowBlockers = () => {
    if (!hasInitialLoad) {
      fetchBlockers();
      setHasInitialLoad(true);
    }
    setShowModal(true);
  };

  useEffect(() => {
    // Filter out resolved blockers FIRST (client-side double protection)
    let filtered = blockers.filter(blocker => !blocker.is_resolved);

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(blocker => blocker.blocker_severity === selectedSeverity);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(blocker => blocker.blocker_type === selectedType);
    }

    if (searchTerm !== '') {
      filtered = filtered.filter(blocker => 
        blocker.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blocker.task_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blocker.step_title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBlockers(filtered);
  }, [blockers, selectedSeverity, selectedType, searchTerm]);

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: 'bg-green-100 text-green-700 border-green-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      critical: 'bg-red-100 text-red-700 border-red-200'
    };
    return (
      <Badge className={`${variants[severity as keyof typeof variants] || ''} px-2 py-1 text-xs`}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'technical': return '🔧';
      case 'resource': return '👥';
      case 'approval': return '✅';
      case 'dependency': return '🔗';
      case 'external': return '🌐';
      default: return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const markResolved = async (b: Blocker) => {
    // Open resolution modal to get resolution details
    // Modal will handle inserting to task_step_history_blocker_resolved
    setResolutionFor(b);
  };

  const handleResolutionComplete = async () => {
    if (!resolutionFor) return;
    
    try {
      // Update is_resolved flag in task_step_history
      // NOTE: This is called AFTER resolution details are inserted to task_step_history_blocker_resolved
      const { error } = await (supabase as any)
        .from('task_step_history')
        .update({ is_resolved: true })
        .eq('id', resolutionFor.id);
      
      if (error) {
        console.error('Error updating blocker resolution status:', error);
        toast({
          title: 'Error',
          description: `Failed to mark blocker as resolved: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      // Verify that resolution was actually saved to task_step_history_blocker_resolved
      const { data: resolutionCheck, error: checkError } = await (supabase as any)
        .rpc('get_blocker_resolutions', {
          p_task_step_history_ids: [resolutionFor.id]
        });
      
      if (checkError) {
        console.error('Error verifying blocker resolution:', checkError);
      } else if (!resolutionCheck || resolutionCheck.length === 0) {
        console.warn('⚠️ Blocker marked as resolved but no resolution entry found in task_step_history_blocker_resolved');
        toast({
          title: 'Warning',
          description: 'Blocker marked as resolved but resolution details may not have been saved',
          variant: 'destructive',
        });
      } else {
        console.log('✅ Resolution verified:', resolutionCheck[0]);
      }
      
      // Update local state to remove from active blockers list
      setBlockers(prev => prev.filter(x => x.id !== resolutionFor.id));
      
      // Update count
      if (blockerCount !== null && blockerCount > 0) {
        setBlockerCount(blockerCount - 1);
      }
      
      // Close modal
      setResolutionFor(null);
      
      // Refresh blockers to show updated state
      await fetchBlockers();
      
      // Switch to resolved tab to show the newly resolved blocker
      setTab('resolved');
      
      // Trigger parent callback if provided
      if (onBlockerUpdate) {
        onBlockerUpdate();
      }
    } catch (error: any) {
      console.error('Unexpected error in handleResolutionComplete:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating blocker status',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const loadResolved = async () => {
      if (!showModal) return;
      const ids = blockers.map(b => b.id);
      if (ids.length === 0) { setResolvedRows([]); return; }
      
      try {
        // Use RPC function to fetch resolved blockers (bypasses RLS overhead)
        const { data, error } = await (supabase as any).rpc('get_blocker_resolutions', {
          p_task_step_history_ids: ids
        });
        
        if (error) {
          console.error('Error loading resolved blockers:', error);
          setResolvedRows([]);
          return;
        }
        
        const mapped = (data || []).map((row: any) => {
          const src = blockers.find(b => b.id === row.task_step_history_id);
          return {
            id: row.id,
            task_step_history_id: row.task_step_history_id,
            description: row.description,
            created_at: row.created_at,
            blocker_description: src?.description || null,
            taskTitle: src?.task_title || '-',
            stepTitle: src?.step_title || '-',
          };
        });
        setResolvedRows(mapped);
        console.log('✅ Loaded resolved blockers:', mapped.length);
      } catch (error) {
        console.error('Error in loadResolved:', error);
        setResolvedRows([]);
      }
    };
    loadResolved();
  }, [showModal, blockers]);



  return (
    <div className="space-y-2">
      {/* Blocker Summary - Show count immediately, lazy load full data on click */}
      <div className="w-full">
        <Button
          variant="outline"
          onClick={handleShowBlockers}
          disabled={loading || countLoading}
          className="w-full h-9 px-3 text-sm text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300 justify-between disabled:opacity-70"
        >
          {countLoading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
              Loading count...
            </span>
          ) : loading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
              Loading details...
            </span>
          ) : blockerCount !== null && blockerCount > 0 ? (
            <>
              <span>Found {blockerCount} Blocker{blockerCount > 1 ? 's' : ''}</span>
              <ChevronRight className="w-4 h-4" />
            </>
          ) : blockerCount === 0 ? (
            <span className="text-gray-500">No blockers this week</span>
          ) : (
            <>
              <span>Check Blockers</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Blocker Details Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Blockers Report
            </DialogTitle>
            <DialogDescription>
              Week Period: {new Date(weekStart).toLocaleDateString('id-ID')} - {new Date(weekEnd).toLocaleDateString('id-ID')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {/* Filters and Search */}
            <div className="flex flex-wrap gap-2 items-center mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <input
                type="text"
                placeholder="Search blockers, tasks, steps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] h-8 px-2 text-sm border border-gray-300 rounded-md"
              />
              
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="all">All Types</option>
                <option value="technical">Technical</option>
                <option value="resource">Resource</option>
                <option value="approval">Approval</option>
                <option value="dependency">Dependency</option>
                <option value="external">External</option>
                <option value="other">Other</option>
              </select>
              
              <div className="text-sm text-gray-600">
                Showing {filteredBlockers.length} of {blockers.length} blockers
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="mb-2">
                <TabsTrigger value="list">Blockers</TabsTrigger>
                <TabsTrigger value="resolved">Blocker Resolved</TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="flex-1 min-h-0">
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading blockers...</p>
                    </div>
                  ) : filteredBlockers.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No blockers found for the selected filters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredBlockers.map((blocker, index) => (
                        <div key={blocker.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                #{index + 1}
                              </span>
                              {getSeverityBadge(blocker.blocker_severity)}
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-2 py-1 text-xs">
                                {getTypeIcon(blocker.blocker_type)} {blocker.blocker_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {blocker.is_resolved && (
                                <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5">Resolved</span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!!blocker.is_resolved}
                                onClick={() => markResolved(blocker)}
                                className={`${blocker.is_resolved ? 'text-gray-400 border-gray-200' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                              >
                                Resolve
                              </Button>
                              <div className="text-xs text-gray-500">
                                {formatDate(blocker.created_at)}
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">{blocker.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {blocker.task_title}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {blocker.step_title}
                            </span>
                          <span className="flex items-center gap-1 whitespace-nowrap">
                              <User className="w-3 h-3" />
                              {blocker.created_by_employee?.full_name || 'Unknown User'}
                            </span>
                            {objectiveInfo[blocker.objective_id] && (
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                <span className={`px-2 py-1 rounded text-xs ${
                                  objectiveInfo[blocker.objective_id].type === 'department' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {objectiveInfo[blocker.objective_id].type === 'department' ? 'Dept' : 'Ind'}: {objectiveInfo[blocker.objective_id].title}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="resolved" className="flex-1 min-h-0">
                <div className="flex-1 min-h-0 seamless-scroll overflow-auto overflow-x-auto">
                  <table className="text-sm min-w-max">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Task</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Step</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Resolved At</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Blocker</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Resolution Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedRows.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500 whitespace-nowrap">No resolved records</td></tr>
                      ) : (
                        resolvedRows.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.taskTitle || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.stepTitle || '-'}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.blocker_description || '-'}</td>
                            <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{row.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                fetchBlockers();
                onBlockerUpdate?.();
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BlockerResolutionModal
        open={!!resolutionFor}
        onOpenChange={(o) => {
          if (!o) {
            setResolutionFor(null);
          }
        }}
        blocker={resolutionFor ? {
          id: resolutionFor.id,
          blocker_type: resolutionFor.blocker_type,
          description: resolutionFor.description,
          created_at: resolutionFor.created_at,
          taskTitle: resolutionFor.task_title,
          stepTitle: resolutionFor.step_title,
          subStepTitle: null,
        } : null}
        onResolutionComplete={handleResolutionComplete}
      />
    </div>
  );
};
