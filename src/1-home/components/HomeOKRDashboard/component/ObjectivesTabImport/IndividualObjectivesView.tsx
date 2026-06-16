import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Building, Plus, Target, ChevronRight, ChevronDown, User, MoreHorizontal, CheckCircle, Calendar, Trash2, Edit } from 'lucide-react';
import { useReportOkrTabStatus } from '@/1-home/context/HomeOkrTabsLoadContext';
import { useReportOkrPageDetail } from '@/1-OKR/context/OkrPageDetailLoadContext';
import { Progress } from '@/shared/components/ui/progress';
import { useOkrEmployeeDirectory } from '../../hooks/useOkrActiveEmployees';
import { useIndividualObjectives, useDeleteIndividualObjective } from '../../modal/useIndividualObjectives';
import { useObjectives } from './useObjectives';
import { useDepartmentObjectives } from '../../modal/useDepartmentObjectives';
import { useDepartments } from './CompanyObjectivesDetailViewImport/useDepartments';
import { CreateIndividualObjectiveModal } from './DepartmentObjectivesViewImport/CreateIndividualObjectiveModal';
import { ModalAddIndividualContribution } from '../../modal/ModalAddIndividualContribution';
import { ObjectiveCheckinForm } from './CompanyObjectivesDetailViewImport/ObjectiveCheckinForm';
import { DeleteIndividualObjectiveDialog } from './DeleteIndividualObjectiveDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useToast } from '@/shared/components/ui/use-toast';
import { UnifiedAvatar } from '@/shared/components/UnifiedAvatar';
import { SocialInsightObjectiveBadge } from '@/6-0-social-media-performance-shared/components/SocialInsightObjectiveBadge';
import { useInsightLinkedIndividualObjectiveIds } from '@/6-0-social-media-performance-shared/hooks/useInsightLinkedIndividualObjectiveIds';
import { useInsightTargetMetricsByObjectiveId } from '@/6-0-social-media-performance-shared/hooks/useInsightTargetMetricsByObjectiveId';
import { useSyncInsightTargetOkrProgress } from '@/6-0-social-media-performance-shared/hooks/useSyncInsightTargetOkrProgress';
import { useSyncDmReportTargetOkrProgress } from '@/6-0-digital-marketing-shared/hooks/useSyncDmReportTargetOkrProgress';
import { useDmReportTargetMetricsByObjectiveId } from '@/6-0-digital-marketing-shared/hooks/useDmReportTargetMetricsByObjectiveId';
import { useDmReportObjectiveProgressByObjectiveId } from '@/6-0-digital-marketing-shared/hooks/useDmReportObjectiveProgressByObjectiveId';
import { DmReportObjectiveBadge } from '@/6-0-digital-marketing-shared/components/DmReportObjectiveBadge';
import { DmReportObjectiveTargetSummary } from '@/6-0-digital-marketing-shared/components/DmReportObjectiveTargetSummary';
import {
  DmReportMetricProgressDisplay,
  getDmReportOkrHeadlineLabel,
} from '@/6-0-digital-marketing-shared/components/DmReportMetricProgressDisplay';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
interface IndividualObjectivesViewProps {
  organizationId: string;
  cycleId?: string;
  cycleIds?: string[];
}
export const IndividualObjectivesView = ({
  organizationId,
  cycleId,
  cycleIds
}: IndividualObjectivesViewProps) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedObjective, setExpandedObjective] = useState<string>('');
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  // Delete Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedObjectiveForDelete, setSelectedObjectiveForDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Create Activity modal state (handler used by dropdown; modal can be wired later)
  const [selectedObjectiveForActivity, setSelectedObjectiveForActivity] = useState<{ id: string; title: string; employeeId: string } | null>(null);
  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);

  // Edit Modal states
  const [editModal, setEditModal] = useState<{
    open: boolean;
    objective?: any;
  }>({
    open: false
  });

  const {
    data: activeEmployees = [],
    isLoading: loadingEmployees,
    error: employeesError,
  } = useOkrEmployeeDirectory(organizationId);
  const { toast } = useToast();
  const { data: linkedInsightIoIds = new Set<string>() } = useInsightLinkedIndividualObjectiveIds();
  const { data: insightMetricsByObjective = new Map() } = useInsightTargetMetricsByObjectiveId();
  const { data: dmMetricsByObjective = new Map() } = useDmReportTargetMetricsByObjectiveId();
  const { data: dmProgressByObjective = new Map() } = useDmReportObjectiveProgressByObjectiveId();
  const { t } = useAppTranslation();
  useSyncInsightTargetOkrProgress(true);
  useSyncDmReportTargetOkrProgress(true);

  // Get individual objectives with key results from useObjectives hook
  const finalCycleIds = cycleIds && cycleIds.length > 0 ? cycleIds : cycleId ? [cycleId] : undefined;
  const finalCycleId = cycleIds && cycleIds.length > 0 ? cycleIds[0] : cycleId; // Use first cycle ID for useObjectives
  
  // console.log('🔍 IndividualObjectivesView - Before useObjectives:', {
  //   organizationId,
  //   finalCycleId,
  //   level: 'individual'
  // });
  
  const {
    data: individualObjectives = [],
    isLoading: loadingObjectives,
    error: individualObjectivesError,
  } = useObjectives(organizationId, finalCycleId, 'individual', finalCycleIds);

  // Get department objectives for showing as key results in Department tab
  const {
    data: departmentObjectives = [],
    isPending: departmentObjectivesPending,
    error: departmentObjectivesError,
  } = useDepartmentObjectives(organizationId, finalCycleIds);

  const {
    departments = [],
    isLoading: loadingDepartments,
    error: departmentsError,
  } = useDepartments(organizationId);

  const individualTabLoading =
    loadingEmployees ||
    loadingObjectives ||
    loadingDepartments ||
    departmentObjectivesPending;
  const individualTabError =
    (employeesError as Error | null | undefined) ||
    (individualObjectivesError as Error | null | undefined) ||
    (departmentObjectivesError as Error | null | undefined) ||
    (departmentsError as Error | null | undefined) ||
    null;
  const individualTabErr =
    individualTabError instanceof Error
      ? individualTabError
      : individualTabError
        ? new Error(String(individualTabError))
        : null;
  useReportOkrTabStatus('individual', individualTabLoading, individualTabErr);
  useReportOkrPageDetail('individual', individualTabLoading, individualTabErr);
  const deleteObjective = useDeleteIndividualObjective();
  const handleCreateObjective = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsCreateModalOpen(true);
  };
  const handleAddContribution = (departmentId: string | undefined) => {
    if (!departmentId) {
      toast({
        title: 'Cannot add contribution',
        description: 'Employee has no department assigned. Please assign a department first.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedDepartmentId(departmentId);
    setShowContributionModal(true);
  };
  
  const handleCreateActivity = (objectiveId: string, objectiveTitle: string, employeeId: string) => {
    setSelectedObjectiveForActivity({
      id: objectiveId,
      title: objectiveTitle,
      employeeId: employeeId
    });
    setShowCreateActivityModal(true);
  };
  
  const handleDeleteObjective = (e: React.MouseEvent, objective: { id: string; title: string }) => {
    e.stopPropagation(); // Prevent accordion toggle
    setSelectedObjectiveForDelete(objective);
    setShowDeleteDialog(true);
  };

  const handleEditObjective = (e: React.MouseEvent, objective: any) => {
    e.stopPropagation(); // Prevent accordion toggle
    setEditModal({
      open: true,
      objective
    });
  };
  
  const toggleEmployee = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };
  const getEmployeeIndividualObjectives = (employeeId: string) => {
    // Filter individual objectives that belong to this employee
    return individualObjectives.filter(obj => (obj as any).employee_id === employeeId);
  };
  const getSyncedProgress = useCallback((objective: any) => {
    // console.log('🔍 Individual Objective Progress Debug:', {
    //   objectiveId: objective.id,
    //   objectiveTitle: objective.title,
    //   hasKeyResults: objective.key_results && objective.key_results.length > 0,
    //   keyResults: objective.key_results,
    //   objectiveProgressPercentage: objective.progress_percentage
    // });
    
    // For individual objectives that have their own key results, 
    // we need to calculate progress from key_results data
    if (objective.key_results && objective.key_results.length > 0) {
      const keyResult = objective.key_results[0]; // Get first key result
      
      if (keyResult.metric_type === 'number') {
        // For numerical metrics, calculate percentage: (current_value / target_value) * 100
        const currentValue = keyResult.current_value ?? 0;
        const targetValue = keyResult.target_value ?? 0;
        if (targetValue <= 0) return 0;
        return (currentValue / targetValue) * 100;
      } else {
        // For percentage metrics, use progress_percentage from key_results
        const progressPercentage = keyResult.progress_percentage || 0;
        
        // console.log('📊 Percentage Metric Progress:', {
        //   progressPercentage
        // });
        
        return progressPercentage;
      }
    }
    
    // Fallback to objective's own progress_percentage for objectives without key results
    const fallbackProgress = objective.progress_percentage || 0;
    
    // console.log('📊 Fallback Progress:', {
    //   fallbackProgress
    // });
    
    return fallbackProgress;
  }, []);

  // Memoize expensive calculations - MUST be before any early returns
  const objectivesByDepartmentAndEmployee = useMemo(() => {
    const grouped = new Map<string, Map<string, any[]>>();

    // Group by department first, then by employee
    individualObjectives.forEach(obj => {
      const deptId = (obj as any).department_id || 'no-department';
      const employeeId = (obj as any).employee_id;
      if (!grouped.has(deptId)) {
        grouped.set(deptId, new Map());
      }
      const deptGroup = grouped.get(deptId)!;
      if (!deptGroup.has(employeeId)) {
        deptGroup.set(employeeId, []);
      }
      deptGroup.get(employeeId)!.push(obj);
    });
    return grouped;
  }, [individualObjectives]);

  // Memoize objectives by employee and status
  const objectivesByEmployeeAndStatus = useMemo(() => {
    const employeeObjectivesMap = new Map<string, Map<string, any[]>>();
    
    individualObjectives.forEach(objective => {
      if (!employeeObjectivesMap.has((objective as any).employee_id)) {
        employeeObjectivesMap.set((objective as any).employee_id, new Map());
      }
      
      const statusMap = employeeObjectivesMap.get((objective as any).employee_id)!;
      if (!statusMap.has((objective as any).status)) {
        statusMap.set((objective as any).status, []);
      }
      
      statusMap.get((objective as any).status)!.push(objective);
    });
    
    return employeeObjectivesMap;
  }, [individualObjectives]);

  if (individualTabLoading) {
    return null;
  }

  if (activeEmployees.length === 0) {
    return (
      <>
        <div className="flex min-h-0 flex-1 w-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-[400px] w-full max-w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-6 text-center">
              <User className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <h3 className="mb-2 text-sm font-medium leading-normal text-gray-900">
                No employees found
              </h3>
              <p className="mb-4 max-w-md text-xs text-gray-600">
                Add employees to your organization to create and track individual objectives.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const getDepartmentName = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    return department?.name || 'Unknown Department';
  };
  const getEmployeeName = (employeeId: string) => {
    const employee = activeEmployees.find(emp => emp.id === employeeId);
    return employee?.full_name || 'Unknown Employee';
  };
  const renderObjectiveCard = (objective: any, departmentId: string, borderColor: string, iconColor: string) => {
    const syncedProgress = getSyncedProgress(objective);
    
    return (
      <AccordionItem key={objective.id} value={objective.id} className={`border-l-4 ${borderColor} shadow-sm mb-4 last:mb-0 w-full`}>
        <AccordionTrigger className="py-4 px-6 hover:bg-gray-50 transition-colors [&[data-state=open]>div>div:first-child>svg]:rotate-180">
          <div className="space-y-4 w-full">
            {/* Title Row */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3 flex-1">
                {/* Dropdown for activities */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="h-8 w-8 p-0 flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <Plus className="h-4 w-4" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-white shadow-lg border z-50">
                    <DropdownMenuItem
                      className="flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateActivity(objective.id, objective.title, (objective as any).employee_id ?? '');
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Create Activity
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center">
                      <Target className="h-4 w-4 mr-2" />
                      Add Milestone
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Target className={`h-4 w-4 ${iconColor}`} />
                <span className="text-base font-semibold text-gray-900 flex-1 text-left">
                  {objective.title}
                </span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0 mr-3">
                <Badge variant="outline" className={`text-xs ${objective.status === 'active' ? 'border-primary/20 bg-success-muted text-success-foreground' : objective.status === 'draft' ? 'border-border bg-neutral-muted text-neutral-status' : 'border-primary/20 bg-info-muted text-info-foreground'}`}>
                  {objective.status === 'active' ? 'Active' : objective.status === 'draft' ? 'Draft' : 'Completed'}
                </Badge>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteObjective(e, { id: objective.id, title: objective.title });
                  }}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded p-0 text-muted-foreground transition-colors hover:bg-warning-muted hover:text-brand-accent"
                  title="Delete objective"
                >
                  <Trash2 className="h-3 w-3" />
                </div>
              </div>
            </div>
            
            {/* Progress Bar with Check In Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Progress</span>
                <div className="flex items-center space-x-3">
                  <div className="flex cursor-pointer items-center space-x-2 rounded border border-primary/25 bg-info-muted px-3 py-1 text-sm hover:bg-accent" onClick={(e) => e.stopPropagation()}>
                    <CheckCircle className="h-4 w-4" />
                    <span>Check In</span>
                  </div>
                  <span className="font-medium">{Math.round(syncedProgress)}%</span>
                </div>
              </div>
              <Progress value={syncedProgress} className="h-3" />
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-6 pb-6 space-y-4">
          {objective.description && (
            <div>
              <p className="text-sm text-gray-600">
                {objective.description}
              </p>
            </div>
          )}
          
          {/* Why this is important section */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-accent p-4">
            <h4 className="mb-2 font-medium text-accent-foreground">Why this is important</h4>
            <p className="text-sm text-accent-foreground/90">
              Achieving this objective will significantly contribute to the department's overall performance metrics and align with our strategic business goals for this quarter.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const renderEmployeeObjectiveCard = (objective: any, employeeId: string, status: string, borderColor: string, iconColor: string) => {
    const syncedProgress = getSyncedProgress(objective);
    const keyResults = objective.key_results ?? [];
    const krCount = keyResults.length;
    const isInsightLinked = linkedInsightIoIds.has(objective.id);
    const insightMetric = insightMetricsByObjective.get(objective.id);
    const dmMetric = dmMetricsByObjective.get(objective.id);
    const dmProgress = dmProgressByObjective.get(objective.id);
    const isDmLinked = Boolean(dmMetric);
    return (
      <AccordionItem key={objective.id} value={objective.id} className={`border-l-4 ${borderColor} shadow-sm mb-2 last:mb-0`}>
        <AccordionTrigger className="py-0 px-0 hover:bg-gray-50 transition-colors [&>svg]:hidden">
          <div className="w-full">
            {/* Header Section */}
            <div className="px-4 py-3">
              {/* Title Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1">
                  <Target className={`h-4 w-4 ${iconColor}`} />
                  <span className="text-sm font-medium text-gray-900 truncate text-left">
                    {objective.title}
                  </span>
                  {isInsightLinked ? <SocialInsightObjectiveBadge /> : null}
                  {isDmLinked ? <DmReportObjectiveBadge /> : null}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div
                    onClick={(e) => handleEditObjective(e, objective)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded p-0 text-muted-foreground hover:bg-accent hover:text-primary"
                    title="Edit objective"
                  >
                    <Edit className="h-3 w-3" />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteObjective(e, { id: objective.id, title: objective.title });
                    }}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded p-0 text-muted-foreground transition-colors hover:bg-warning-muted hover:text-brand-accent"
                    title="Delete objective"
                  >
                    <Trash2 className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>

            {isDmLinked && dmMetric ? (
              <div className="px-4 pb-2">
                <DmReportObjectiveTargetSummary
                  metric={dmMetric}
                  metricDirections={dmProgress?.metricDirections}
                />
              </div>
            ) : null}
            
            {/* Weekly Check-in Button with Progress Info */}
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                  <ObjectiveCheckinForm
                    objectiveId={objective.id}
                    objectiveTitle={objective.title}
                    trigger={
                      <div className="flex h-7 cursor-pointer items-center space-x-1 rounded border border-primary/25 bg-info-muted px-2 text-xs text-primary hover:bg-accent hover:text-primary">
                        <Calendar className="h-3 w-3" />
                        <span>Weekly Check-in</span>
                      </div>
                    }
                  />
                  <Badge variant="outline" className="text-xs bg-gray-50">
                    {krCount} KRs
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${
                    status === 'active' ? 'border-primary/20 bg-success-muted text-success-foreground' :
                    status === 'draft' ? 'border-border bg-neutral-muted text-neutral-status' :
                    'border-primary/20 bg-info-muted text-info-foreground'
                  }`}>
                    {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Completed'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500">Average Progress</span>
                  <span className="font-medium tabular-nums">
                    {isDmLinked && dmProgress
                      ? getDmReportOkrHeadlineLabel(dmProgress, t)
                      : `${Math.round(syncedProgress)}%`}
                  </span>
                </div>
              </div>
              {isDmLinked && dmProgress ? (
                <DmReportMetricProgressDisplay input={dmProgress} showLabel={false} size="sm" />
              ) : (
                <Progress value={syncedProgress} className="h-2" />
              )}
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4">
          {isInsightLinked && insightMetric ? (
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                Insight Target
              </h4>
              <div className="rounded-lg border border-primary/20 bg-info-muted p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">Target progress</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(syncedProgress)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">Target</span>
                  <span className="font-medium text-foreground">
                    {insightMetric.targetValue} {insightMetric.unit}
                  </span>
                </div>
                <Progress value={syncedProgress} className="mt-2 h-2 bg-muted" />
              </div>
            </div>
          ) : null}
          {isDmLinked && dmMetric ? (
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                Paid Ads Target
              </h4>
              <DmReportObjectiveTargetSummary
                metric={dmMetric}
                metricDirections={dmProgress?.metricDirections}
                variant="card"
              />
              {dmProgress ? (
                <DmReportMetricProgressDisplay input={dmProgress} size="sm" />
              ) : (
                <Progress value={syncedProgress} className="h-2" />
              )}
            </div>
          ) : null}
          {!isInsightLinked && !isDmLinked && keyResults.length > 0 ? (
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-700">
                Key Results
              </h4>
              {keyResults.map((kr: any) => (
                <div key={kr.id} className="rounded-lg border border-primary/20 bg-info-muted p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{kr.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(kr.progress_percentage || 0)}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-primary">Progress</span>
                      <span className="font-medium text-foreground">
                        {kr.current_value ?? 0} / {kr.target_value} {kr.unit || ''}
                      </span>
                    </div>
                    <Progress value={kr.progress_percentage || 0} className="h-2 bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Why this is important section */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-info-muted p-4">
            <h4 className="mb-2 text-sm font-medium uppercase tracking-wide text-info-foreground">
              WHY THIS IS IMPORTANT:
            </h4>
            <p className="text-sm text-info-foreground/90">
              {objective.why_important || 'Supporting company objective by contributing to key metrics and departmental goals for this quarter.'}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };


  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 w-full flex-col">
        <div className="min-h-0 flex-1 space-y-2 pb-1">
            {activeEmployees.map(employee => {
              const employeeObjectivesMap = objectivesByEmployeeAndStatus.get(employee.id) || new Map();
              const activeObjectives = employeeObjectivesMap.get('active') || [];
              const draftObjectives = employeeObjectivesMap.get('draft') || [];
              const completedObjectives = employeeObjectivesMap.get('completed') || [];
              const totalObjectives = activeObjectives.length + draftObjectives.length + completedObjectives.length;
              
              return (
                <div key={employee.id} className="border border-gray-200 rounded-lg w-full">
                  <Collapsible open={expandedEmployees.has(employee.id)} onOpenChange={() => toggleEmployee(employee.id)}>
                    <CollapsibleTrigger asChild>
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-3 flex-1">
                            {expandedEmployees.has(employee.id) ? 
                              <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            }
                            <UnifiedAvatar
                              photoUrl={employee.profile_photo_url ?? employee.photo_url}
                              name={employee.full_name || 'Unknown Employee'}
                              size="sm"
                              clickable={false}
                            />
                            <div>
                              <span className="font-medium text-gray-900">{employee.full_name || 'Unknown Employee'}</span>
                              <p className="text-sm text-gray-500">{employee.job_position_name || 'No Position'}</p>
                            </div>
                            <Badge variant="outline" className="border-primary/20 bg-info-muted text-xs text-primary">
                              {totalObjectives} Objectives
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {/* Three Dots Dropdown Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="h-8 w-8 p-0 flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer" onClick={e => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={e => {
                                  e.stopPropagation();
                                  handleCreateObjective(employee.id);
                                }} className="flex items-center">
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Objective
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => {
                                  e.stopPropagation();
                                  handleAddContribution(employee.department_id);
                                }} className="flex items-center">
                                  <Target className="h-4 w-4 mr-2" />
                                  Add Contribution
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="p-4">
                        {totalObjectives === 0 ? (
                          <div className="text-center py-8">
                            <Target className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                            <h4 className="font-medium text-gray-900 mb-2">No objectives for {employee.full_name}</h4>
                            <p className="text-sm text-gray-500 mb-4">
                              Create objectives to track personal goals and contributions.
                            </p>
                            <div className="flex justify-center space-x-2">
                              <Button size="sm" onClick={() => handleCreateObjective(employee.id)}>
                                <Plus className="mr-1 h-3 w-3" />
                                Create Objective
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleAddContribution(employee.department_id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Add Contribution
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Active Objectives */}
                            {activeObjectives.length > 0 && (
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <Target className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium text-gray-900">Active</span>
                                  <Badge variant="outline" className="border-primary/20 bg-success-muted text-xs text-success-foreground">
                                    {activeObjectives.length}
                                  </Badge>
                                </div>
                                <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                  {activeObjectives.map(objective => 
                                    renderEmployeeObjectiveCard(objective, employee.id, 'active', 'border-l-primary', 'text-primary')
                                  )}
                                </Accordion>
                              </div>
                            )}

                            {/* Draft Objectives */}
                            {draftObjectives.length > 0 && (
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium text-gray-900">Draft</span>
                                  <Badge variant="outline" className="border-border bg-neutral-muted text-xs text-neutral-status">
                                    {draftObjectives.length}
                                  </Badge>
                                </div>
                                <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                  {draftObjectives.map(objective => 
                                    renderEmployeeObjectiveCard(objective, employee.id, 'draft', 'border-l-muted-foreground', 'text-muted-foreground')
                                  )}
                                </Accordion>
                              </div>
                            )}

                            {/* Completed Objectives */}
                            {completedObjectives.length > 0 && (
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium text-gray-900">Completed</span>
                                  <Badge variant="outline" className="border-primary/20 bg-info-muted text-xs text-info-foreground">
                                    {completedObjectives.length}
                                  </Badge>
                                </div>
                                <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                  {completedObjectives.map(objective => 
                                    renderEmployeeObjectiveCard(objective, employee.id, 'completed', 'border-l-primary', 'text-primary')
                                  )}
                                </Accordion>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
        </div>
      </div>

      {selectedEmployee && (
        <CreateIndividualObjectiveModal
          open={isCreateModalOpen}
          onOpenChange={(open) => {
            setIsCreateModalOpen(open);
            if (!open) setSelectedEmployee(null);
          }}
          organizationId={organizationId}
          cycleId={cycleId || ''}
          employeeId={selectedEmployee}
          employeeName={activeEmployees.find((emp) => emp.id === selectedEmployee)?.full_name || 'Unknown Employee'}
          onSuccess={() => {}}
        />
      )}

      <ModalAddIndividualContribution
        open={showContributionModal}
        onOpenChange={setShowContributionModal}
        organizationId={organizationId}
        cycleId={cycleId || finalCycleIds?.[0] || ''}
        cycleIds={finalCycleIds}
        departmentId={selectedDepartmentId || undefined}
        onSuccess={() => {}}
      />

      <DeleteIndividualObjectiveDialog
        objective={selectedObjectiveForDelete}
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedObjectiveForDelete(null);
        }}
      />

      {editModal.open && editModal.objective && (
        <ModalAddIndividualContribution
          open={editModal.open}
          onOpenChange={(open) => setEditModal({ open })}
          organizationId={organizationId}
          cycleId={cycleId || finalCycleIds?.[0] || ''}
          cycleIds={finalCycleIds}
          editObjective={editModal.objective}
          onSuccess={() => setEditModal({ open: false })}
        />
      )}
    </>
  );
};
