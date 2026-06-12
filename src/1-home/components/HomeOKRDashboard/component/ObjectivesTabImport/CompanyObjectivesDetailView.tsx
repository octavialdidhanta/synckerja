import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Building,
  Plus,
  Target,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  Trash2,
  Edit,
  Loader2,
} from 'lucide-react';
import { useReportOkrTabStatus } from '@/1-home/context/HomeOkrTabsLoadContext';
import { useReportOkrPageDetail } from '@/1-OKR/context/OkrPageDetailLoadContext';
import { logger } from '@/shared/lib/logger';
import { useObjectives } from './useObjectives';
import { useFilteredObjectives } from './useFilteredObjectives';
import { useDeleteCompanyObjective } from '../../hooks/useDeleteCompanyObjective';
import { useDepartmentObjectives } from '../../modal/useDepartmentObjectives';
import { useIndividualObjectives } from '../../modal/useIndividualObjectives';
import { useDepartments } from './CompanyObjectivesDetailViewImport/useDepartments';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentOrg } from '../../hooks/useCurrentOrg';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { YearQuarterSelection } from '../FiturTimePeriod';
import { filterCyclesByYearQuarter, hasYearQuarterSelection } from '../yearQuarterFilter';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
// import { WeeklyCheckinForm } from './CompanyObjectivesDetailViewImport/WeeklyCheckinDialog';
import { ObjectiveCheckinForm } from './CompanyObjectivesDetailViewImport/ObjectiveCheckinForm';
// TODO: Update to use ModalAddCompanyContribution
// import { ModalCreateObjective } from '../components/ModalCreateObjective';
import { CreateKeyResultDialog } from './CompanyObjectivesDetailViewImport/CreateKeyResultDialog';
import { KeyResultApprovalButtons } from './CompanyObjectivesDetailViewImport/KeyResultApprovalButtons';
import { SectionActiveObjectives } from './CompanyObjectivesDetailViewImport/SectionActiveObjectives';
import { SectionDraftObjectives } from './CompanyObjectivesDetailViewImport/SectionDraftObjectives';
import { SectionCompletedObjectives } from './CompanyObjectivesDetailViewImport/SectionCompletedObjectives';
import { ModalAddIndividualContribution } from '../../modal/ModalAddIndividualContribution';
import { ModalAddDepartmentContribution } from '../../modal/ModalAddDepartmentContribution';
import { AddObjectiveDialog } from '../../../AddObjectiveDialog';
import { CompanyObjectivesEmptyState } from './CompanyObjectivesEmptyState';
interface CompanyObjectivesViewProps {
  organizationId: string;
  cycleId?: string;
  cycleIds?: string[]; // Support for multiple cycle IDs
  yearQuarterSelection?: YearQuarterSelection; // Add yearQuarterSelection prop
  onYearQuarterChange?: (selection: YearQuarterSelection) => void; // Add onYearQuarterChange prop
  /** OKR full-page route: no inline spinners; page skeleton is the only load UI. */
  okrStandaloneUi?: boolean;
}
export const CompanyObjectivesDetailView = ({
  organizationId,
  cycleId,
  cycleIds,
  yearQuarterSelection: propYearQuarterSelection,
  onYearQuarterChange: propOnYearQuarterChange,
  okrStandaloneUi = false,
}: CompanyObjectivesViewProps) => {
  const [expandedObjective, setExpandedObjective] = useState<string>('');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedIndividualObjectives, setExpandedIndividualObjectives] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createKRDialog, setCreateKRDialog] = useState<{
    open: boolean;
    objective?: any;
  }>({
    open: false
  });
  const [editModal, setEditModal] = useState<{
    open: boolean;
    objective?: any;
    type?: 'individual' | 'department';
  }>({
    open: false
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for period selector and dropdown
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  
  // Use prop yearQuarterSelection or fallback to local state
  const [localYearQuarterSelection, setLocalYearQuarterSelection] = useState<YearQuarterSelection>({
    years: {}
  });
  
  const yearQuarterSelection = propYearQuarterSelection || localYearQuarterSelection;
  const onYearQuarterChange = propOnYearQuarterChange || setLocalYearQuarterSelection;
  
  const {
    organizationId: currentOrgId
  } = useCurrentOrg();
  
  const {
    data: cycles = [],
    isLoading: isLoadingCycles
  } = useOkrCycles(organizationId);

  // Get available years from cycles
  const availableYears = cycles.length > 0 ? cycles.map(c => c.year).filter((year, index, arr) => arr.indexOf(year) === index).sort((a, b) => b - a) : undefined;

  // Calculate filtered cycle IDs for objectives - same as AttendanceSection.tsx
  const getFilteredCycleIds = (yearQuarterSelection: YearQuarterSelection) => {
    return hasYearQuarterSelection(yearQuarterSelection) 
      ? filterCyclesByYearQuarter(cycles, yearQuarterSelection)
      : undefined;
  };

  // Get filtered cycle IDs based on current selection
  const filteredCycleIds = getFilteredCycleIds(yearQuarterSelection);
  
  // Memoized debug info to prevent excessive logging
  const debugInfo = useMemo(() => ({
    yearQuarterSelection,
    filteredCycleIds,
    cycleIds,
    cycles: cycles.map(c => ({ id: c.id, name: c.name, year: c.year, quarter: c.quarter }))
  }), [yearQuarterSelection, filteredCycleIds, cycleIds, cycles]);

  // Optimized debug logging - only log when data actually changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 
        debugInfo.filteredCycleIds && 
        debugInfo.filteredCycleIds.length > 0) {
      logger.debug('🔍 CompanyObjectivesDetailView Debug:', debugInfo);
    }
  }, [debugInfo]);
  
  // Calculate dynamic title based on filtered cycles
  const getDynamicTitle = () => {
    if (!filteredCycleIds || filteredCycleIds.length === 0) {
      return 'Company Objectives';
    }
    
    const filteredCycles = cycles.filter(cycle => filteredCycleIds.includes(cycle.id));
    if (filteredCycles.length === 1) {
      return `Company Objectives - ${filteredCycles[0].name}`;
    } else if (filteredCycles.length > 1) {
      const years = [...new Set(filteredCycles.map(c => c.year))];
      return `Company Objectives - ${years.join(', ')}`;
    }
    
    return 'Company Objectives';
  };
  
  const loading = false;
  const error = null;
  const onToggleQuarterDropdown = () => setShowQuarterDropdown(!showQuarterDropdown);
  
  const getDisplayText = () => {
    if (!filteredCycleIds || filteredCycleIds.length === 0) {
      return 'All Periods';
    }
    
    const filteredCycles = cycles.filter(cycle => filteredCycleIds.includes(cycle.id));
    if (filteredCycles.length === 1) {
      return filteredCycles[0].name;
    } else if (filteredCycles.length > 1) {
      return `${filteredCycles.length} periods selected`;
    }
    
    return 'All Periods';
  };
  
  const onClearAll = () => setSelectedQuarters([]);
  const quarters = [
    { id: 'q1-2025', label: 'Q1 2025' },
    { id: 'q2-2025', label: 'Q2 2025' },
    { id: 'q3-2025', label: 'Q3 2025' },
    { id: 'q4-2025', label: 'Q4 2025' }
  ];
  const onQuarterToggle = (quarterId: string) => {
    logger.debug('onQuarterToggle called with:', quarterId);
    setSelectedQuarters(prev => {
      const newSelection = prev.includes(quarterId) 
        ? prev.filter(id => id !== quarterId)
        : [...prev, quarterId];
      logger.debug('New selection:', newSelection);
      return newSelection;
    });
  };
  const onToggleYear = (year: string) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  // Use filtered cycle IDs for objectives - same as AttendanceSection.tsx
  const shouldUseFilteredObjectives = filteredCycleIds && filteredCycleIds.length > 0;
  
  // For single cycle, use existing hook with 'company' level
  const singleObjectivesQuery = useObjectives(organizationId, shouldUseFilteredObjectives ? undefined : cycleId || undefined, 'company');
  
  // For multiple cycles, use filtered hook with proper cycle IDs array
  const filteredObjectivesQuery = useFilteredObjectives(organizationId, shouldUseFilteredObjectives ? filteredCycleIds : undefined, 'company');

  // Choose the appropriate query result
  const {
    objectives: companyObjectives = [],
    isLoading: loadingObjectives,
    error: companyObjectivesQueryError,
  } = shouldUseFilteredObjectives ? filteredObjectivesQuery : singleObjectivesQuery;
  const companyObjectivesReady = !loadingObjectives && !isLoadingCycles;
  const loadRelatedObjectives = companyObjectivesReady && companyObjectives.length > 0;

  const {
    departments = [],
    isLoading: loadingDepartments,
    error: departmentsQueryError,
  } = useDepartments(loadRelatedObjectives ? organizationId : undefined);
  const {
    user: currentUser
  } = useCurrentUser();

  // Use the actual delete hook
  const deleteCompanyObjective = useDeleteCompanyObjective();

  // Fetch department objectives from department_objectives table - use filtered cycle IDs
  const {
    data: departmentObjectives = [],
    isLoading: loadingDepartmentObjectives,
    error: departmentObjectivesQueryError,
  } = useDepartmentObjectives(organizationId, filteredCycleIds, true, loadRelatedObjectives);

  // Fetch individual objectives from individual_objectives table - use filtered cycle IDs
  const {
    data: individualObjectives = [],
    isLoading: loadingIndividualObjectives,
    error: individualObjectivesQueryError,
  } = useIndividualObjectives(organizationId, filteredCycleIds, loadRelatedObjectives);
  const allObjectives: any[] = [];
  const loadingAllObjectives = loadingDepartmentObjectives || loadingIndividualObjectives;

  const companyShellLoading = isLoadingCycles || loadingObjectives;
  const companyTabLoading =
    companyShellLoading ||
    (loadRelatedObjectives &&
      (loadingDepartments || loadingDepartmentObjectives || loadingIndividualObjectives));
  const companyTabError =
    (companyObjectivesQueryError as Error | null | undefined) ||
    (departmentsQueryError as Error | null | undefined) ||
    (departmentObjectivesQueryError as Error | null | undefined) ||
    (individualObjectivesQueryError as Error | null | undefined) ||
    null;
  const companyTabErr =
    companyTabError instanceof Error
      ? companyTabError
      : companyTabError
        ? new Error(String(companyTabError))
        : null;
  useReportOkrTabStatus('company', companyTabLoading, companyTabErr);
  useReportOkrPageDetail('company', companyTabLoading, companyTabErr);

  // Helper function to get department name
  const getDepartmentName = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    return department?.name || 'Unknown Department';
  };

  // Helper function to get department objectives for a company objective
  const getDepartmentObjectives = (companyObjective: any) => {
    return allObjectives.filter(obj => obj.parent_objective_id === companyObjective.id && obj.level === 'department');
  };

  // Helper function to calculate progress for individual objective from key_results
  const getIndividualObjectiveProgress = (indObj: any) => {
    logger.debug('🔍 Calculating progress for individual objective:', {
      id: indObj.id,
      title: indObj.title,
      hasKeyResults: indObj.key_results && indObj.key_results.length > 0,
      keyResults: indObj.key_results,
      objectiveProgress: indObj.progress_percentage
    });
    
    // If individual objective has key_results, calculate progress from them
    if (indObj.key_results && indObj.key_results.length > 0) {
      const keyResult = indObj.key_results[0]; // Get first key result
      
      logger.debug('📊 Key result data:', keyResult);
      
      if (keyResult.metric_type === 'number') {
        // For numerical metrics, calculate percentage: (current_value / target_value) * 100
        const currentValue = keyResult.current_value || 0;
        const targetValue = keyResult.target_value || 1;
        const calculatedProgress = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
        
        logger.debug('🔢 Numerical metric progress:', {
          currentValue,
          targetValue,
          calculatedProgress
        });
        
        return calculatedProgress;
      } else {
        // For percentage metrics, use progress_percentage from key_results
        const progressPercentage = keyResult.progress_percentage || 0;
        
        logger.debug('📊 Percentage metric progress:', {
          progressPercentage
        });
        
        return progressPercentage;
      }
    }
    
    // Fallback to objective's own progress_percentage for objectives without key results
    const fallbackProgress = indObj.progress_percentage || 0;
    
    logger.debug('📊 Fallback progress:', {
      fallbackProgress
    });
    
    return fallbackProgress;
  };

  // Helper function to get individual objectives for a department objective  
  const getIndividualObjectivesForDepartment = (departmentObjectiveId: string) => {
    return individualObjectives.filter(indObj => indObj.department_objective_id === departmentObjectiveId);
  };

  // Helper function to toggle individual objectives expansion
  const toggleIndividualObjectives = (departmentObjectiveId: string) => {
    const newExpanded = new Set(expandedIndividualObjectives);
    if (newExpanded.has(departmentObjectiveId)) {
      newExpanded.delete(departmentObjectiveId);
    } else {
      newExpanded.add(departmentObjectiveId);
    }
    setExpandedIndividualObjectives(newExpanded);
  };

  // Helper function to collect department objectives only (not key_results)
  const getRelatedKeyResults = (companyObjective: any) => {
    // Only get department objectives from department_objectives table
    const relatedDepartmentObjectives = departmentObjectives.filter(deptObj => deptObj.company_objective_id === companyObjective.id);

    // Convert department objectives to key result format for display
    const departmentKRs = relatedDepartmentObjectives.map((deptObj: any) => ({
      id: deptObj.id,
      title: deptObj.title,
      description: deptObj.description,
      current_value: deptObj.progress_percentage || 0,
      target_value: 100,
      start_value: 0,
      unit: '%',
      progress_percentage: deptObj.progress_percentage || 0,
      metric_type: 'percentage',
      weight: deptObj.weight || 100,
      source_type: 'department_objective',
      department_id: deptObj.department_id,
      department_name: getDepartmentName(deptObj.department_id),
      why_important: deptObj.why_important,
      owner_id: deptObj.owner_id,
      status: deptObj.status
    }));
    return departmentKRs;
  };

  // Enhance company objectives with all related key results
  const enhancedCompanyObjectives = companyObjectives.map(objective => ({
    ...objective,
    all_key_results: getRelatedKeyResults(objective)
  }));

  // Helper function to get actual progress from progress_percentage directly
  const getActualProgress = (keyResult: any): number => {
    // Use progress_percentage directly from database
    return keyResult.progress_percentage || 0;
  };

  // Helper function to check if objective has actual progress
  const hasActualProgress = (objective: any) => {
    // Check if objective has progress_percentage > 0
    return (objective.progress_percentage || 0) > 0;
  };
  // Remove this function - accordion behavior will be handled by Accordion component
  const getObjectivesByStatus = (status: string) => {
    return enhancedCompanyObjectives.filter(obj => obj.status === status);
  };
  const handleCreateKR = (objective: any) => {
    setCreateKRDialog({
      open: true,
      objective
    });
  };

  const handleDeleteObjective = (e: React.MouseEvent, objectiveId: string, objectiveTitle: string) => {
    e.stopPropagation(); // Prevent accordion toggle
    
    const confirmMessage = `Are you sure you want to delete "${objectiveTitle}"?\n\nThis action cannot be undone and will also remove all associated department objectives, key results, and progress data.`;
    
    if (confirm(confirmMessage)) {
      logger.debug('🗑️ User confirmed deletion of company objective:', { objectiveId, objectiveTitle });
      deleteCompanyObjective.mutate(objectiveId);
    }
  };

  const handleEditObjective = (e: React.MouseEvent, objective: any) => {
    e.stopPropagation(); // Prevent accordion toggle
    
    // For Company Objectives, we should use AddObjectiveDialog with type 'company'
    // This will open the "Create Objective for Company" modal
    setEditModal({
      open: true,
      objective,
      type: 'company'
    });
  };
  const defaultCreateCycleId =
    filteredCycleIds?.[0] ??
    cycles.find((c) => c.is_active)?.id ??
    cycles[0]?.id;

  const createCompanyObjectiveDialog = (
    <AddObjectiveDialog
      type="company"
      open={showCreateDialog}
      onOpenChange={setShowCreateDialog}
      organizationId={organizationId}
      defaultCycleId={defaultCreateCycleId}
      onObjectiveAdded={() => setShowCreateDialog(false)}
    />
  );

  if (companyShellLoading || companyObjectives.length === 0) {
    return (
      <>
        <CompanyObjectivesEmptyState
          pending={loadingObjectives && companyObjectives.length === 0}
          onAddClick={
            loadingObjectives && companyObjectives.length === 0
              ? undefined
              : () => setShowCreateDialog(true)
          }
        />
        {createCompanyObjectiveDialog}
      </>
    );
  }

  // Calculate overall company progress
  const calculateOverallProgress = () => {
    if (enhancedCompanyObjectives.length === 0) return 0;
    const totalProgress = enhancedCompanyObjectives.reduce((sum, obj) => {
      if (obj.all_key_results && obj.all_key_results.length > 0) {
        const objProgress = obj.all_key_results.reduce((krSum, kr) => krSum + (kr.progress_percentage || 0), 0) / obj.all_key_results.length;
        return sum + objProgress;
      }
      return sum;
    }, 0);
    return Math.round(totalProgress / enhancedCompanyObjectives.length);
  };
  const activeObjectives = getObjectivesByStatus('active');
  const draftObjectives = getObjectivesByStatus('draft');
  const completedObjectives = getObjectivesByStatus('completed');
  const renderObjectiveCard = (objective: any, status: string, borderColor: string, iconColor: string) => {
    // Use progress_percentage directly from database
    const actualProgress = objective.progress_percentage || 0;
    
    return (
      <AccordionItem key={objective.id} value={objective.id} className={`border-l-4 ${borderColor} shadow-sm mb-2 last:mb-0`}>
        <AccordionTrigger className="py-3 px-4 hover:bg-gray-50 transition-colors [&[data-state=open]>div>div:first-child>svg]:rotate-180">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2 flex-1">
              <Target className={`h-4 w-4 ${iconColor}`} />
              <span className="text-sm font-medium text-gray-900 truncate text-left leading-normal">
                {objective.title}
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 mr-3" onClick={(e) => e.stopPropagation()}>
              <div
                onClick={(e) => handleEditObjective(e, objective)}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded p-0 text-muted-foreground hover:bg-accent hover:text-primary"
                title="Edit objective"
              >
                <Edit className="h-3 w-3" />
              </div>
              <div
                onClick={(e) => handleDeleteObjective(e, objective.id, objective.title)}
                className={`h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer rounded ${deleteCompanyObjective.isPending ? 'opacity-50' : ''}`}
                title={deleteCompanyObjective.isPending ? 'Deleting...' : 'Delete objective'}
              >
                {deleteCompanyObjective.isPending ? (
                  okrStandaloneUi ? (
                    <Trash2 className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
                  ) : (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                  )
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        
        {/* Average Progress Bar moved outside trigger */}
        {objective.all_key_results && objective.all_key_results.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-primary font-medium">Average Progress</span>
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="text-xs font-medium leading-tight">
                  {objective.all_key_results?.length || 0} KRs
                </Badge>
                <Badge variant="outline" className={`text-xs font-medium leading-tight ${status === 'active' ? 'bg-success-muted text-success-foreground border-primary/20' : status === 'draft' ? 'bg-neutral-muted text-neutral-status border-border' : 'bg-info-muted text-info-foreground border-primary/20'}`}>
                  {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Completed'}
                </Badge>
                <span className="font-medium text-primary">
                  {Math.round(objective.all_key_results.reduce((sum, kr) => sum + (kr.progress_percentage || 0), 0) / objective.all_key_results.length)}%
                </span>
              </div>
            </div>
            <Progress value={objective.all_key_results.reduce((sum, kr) => sum + (kr.progress_percentage || 0), 0) / objective.all_key_results.length} className="h-2" />
            
            {/* Why this is important section */}
            {objective.why_important && (
              <div className="bg-info-muted p-3 rounded-lg mt-3">
                <h5 className="font-medium text-xs text-foreground mb-1 uppercase tracking-wide">
                  Why this is important:
                </h5>
                <p className="text-sm text-blue-800">
                  {objective.why_important}
                </p>
              </div>
            )}
          </div>
        )}
        
        <AccordionContent className="px-4 pb-4">
          {objective.description && (
            <p className="text-sm text-gray-600 mb-3">
              {objective.description}
            </p>
          )}

          {status !== 'draft' && hasActualProgress(objective) && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Progress</span>
                <span className={`font-medium ${status === 'completed' ? 'text-primary' : ''}`}>
                  {status === 'completed' ? '100%' : `${actualProgress}%`}
                </span>
              </div>
              <Progress value={status === 'completed' ? 100 : actualProgress} className="h-2" />
            </div>
          )}
          
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Key Results
              </h4>
              <Button variant="outline" size="sm" onClick={() => handleCreateKR(objective)} className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add KR
              </Button>
            </div>
            
            {/* Display All Key Results (Company + Department Objectives) */}
            {objective.all_key_results && objective.all_key_results.length > 0 && (
              <div
                className={`space-y-2 mb-4 min-h-0 pr-2 ${
                  okrStandaloneUi
                    ? ""
                    : "max-h-[520px] overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain"
                }`}
              >
                {objective.all_key_results.map((kr: any) => {
                  const actualKRProgress = getActualProgress(kr);
                  const isDepartmentObjective = kr.source_type === 'department_objective';
                  const bgColor = isDepartmentObjective ? 'bg-success-muted' : 'bg-info-muted';
                  const borderColor = isDepartmentObjective ? 'border-primary/20' : 'border-primary/20';
                  const iconColor = isDepartmentObjective ? 'text-primary' : 'text-primary';
                  const textColor = isDepartmentObjective ? 'text-foreground' : 'text-foreground';
                  const labelColor = isDepartmentObjective ? 'text-success-foreground' : 'text-info-foreground';
                  const relatedIndividualObjectives = isDepartmentObjective ? getIndividualObjectivesForDepartment(kr.id) : [];
                  
                  return (
                    <div key={`kr-${kr.id}-${isDepartmentObjective ? 'dept' : 'regular'}`} className={`${bgColor} border ${borderColor} rounded-lg p-3 w-full`}>
                      <div className="flex items-center justify-between mb-2 w-full">
                        <div className="flex items-center space-x-2 flex-1">
                          {isDepartmentObjective && relatedIndividualObjectives.length > 0 && (
                            <span 
                              className="cursor-pointer text-gray-600 hover:text-gray-800"
                              onClick={e => {
                                e.stopPropagation();
                                toggleIndividualObjectives(kr.id);
                              }}
                            >
                              {expandedIndividualObjectives.has(kr.id) ? '>' : '>'}
                            </span>
                          )}
                          <Building className={`h-4 w-4 ${iconColor}`} />
                          <span className={`text-sm font-medium ${textColor}`}>{kr.title}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs w-full">
                          <ObjectiveCheckinForm
                            objectiveId={kr.id}
                            objectiveTitle={kr.title}
                            disableActivitiesTab={true}
                            trigger={
                              <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-primary/20 bg-info-muted hover:bg-accent hover:text-info-foreground text-primary h-7 px-3 text-xs cursor-pointer">
                                <Calendar className="h-3 w-3 mr-1" />
                                Weekly Check-in
                              </div>
                            }
                          />
                          <div className="flex items-center space-x-3 flex-shrink-0">
                            <span className={`${labelColor} font-medium`}>Progress</span>
                            {kr.metric_type === 'number' ? (
                              <span className={`${textColor} font-medium`}>
                                {kr.current_value || 0} / {kr.target_value} {kr.unit || ''}
                              </span>
                            ) : (
                              <span className={`${textColor} font-medium`}>
                                {actualKRProgress}%
                              </span>
                            )}
                          </div>
                        </div>
                        {kr.metric_type === 'number' ? (
                          <Progress 
                            value={((kr.current_value || 0) / kr.target_value) * 100} 
                            className="h-2" 
                          />
                        ) : (
                          <Progress value={actualKRProgress} className="h-2" />
                        )}
                      </div>
                      
                      {kr.department_name && (
                        <p className={`text-xs ${labelColor} mt-2`}>
                          {kr.department_name}
                        </p>
                      )}
                      
                      {kr.why_important && (
                        <div className={`${isDepartmentObjective ? 'bg-accent' : 'bg-accent'} p-2 rounded-md mt-2`}>
                          <h6 className={`font-medium text-xs ${isDepartmentObjective ? 'text-foreground' : 'text-foreground'} mb-1 uppercase tracking-wide`}>
                            Why this is important:
                          </h6>
                          <p className={`text-xs ${isDepartmentObjective ? 'text-foreground' : 'text-blue-800'}`}>
                            {kr.why_important}
                          </p>
                        </div>
                      )}
                      
                      {/* Approval Buttons only for actual Key Results, not Department Objectives */}
                      {!isDepartmentObjective && (
                        <KeyResultApprovalButtons
                          keyResultId={kr.id}
                          isDepartmentLevel={false}
                        />
                      )}
                      
                      {/* Individual Objectives linked to this Department Objective */}
                      {isDepartmentObjective && expandedIndividualObjectives.has(kr.id) && relatedIndividualObjectives.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-primary/25">
                          <h6 className="text-xs font-medium text-foreground mb-2 uppercase tracking-wide">Individual Objectives:</h6>
                          <div className="space-y-2">
                            {relatedIndividualObjectives.map((indObj: any) => {
                              const correctProgress = getIndividualObjectiveProgress(indObj);
                              return (
                                <div key={indObj.id} className="bg-white border border-primary/25 rounded-md p-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">{indObj.title}</span>
                                    <Badge variant="outline" className="text-xs bg-accent text-foreground">
                                      {Math.round(correctProgress)}%
                                    </Badge>
                                  </div>
                                  <Progress value={correctProgress} className="h-1 mt-1" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {(!objective.all_key_results || objective.all_key_results.length === 0) && (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">No key results yet</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleCreateKR(objective)}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Key Result
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };
  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 w-full flex-col">
        <div className="min-h-0 flex-1 space-y-4 pb-1">
            {/* Active Objectives */}
            <SectionActiveObjectives
              activeObjectives={activeObjectives}
              expandedObjective={expandedObjective}
              setExpandedObjective={setExpandedObjective}
              renderObjectiveCard={renderObjectiveCard}
            />

            {/* Draft Objectives */}
            <SectionDraftObjectives
              draftObjectives={draftObjectives}
              expandedObjective={expandedObjective}
              setExpandedObjective={setExpandedObjective}
              renderObjectiveCard={renderObjectiveCard}
            />

            {/* Completed Objectives */}
            <SectionCompletedObjectives
              completedObjectives={completedObjectives}
              expandedObjective={expandedObjective}
              setExpandedObjective={setExpandedObjective}
              renderObjectiveCard={renderObjectiveCard}
            />
        </div>
      </div>

      {createKRDialog.open && createKRDialog.objective && (
        <CreateKeyResultDialog
          open={createKRDialog.open}
          onOpenChange={open => setCreateKRDialog({ open })}
          objective={createKRDialog.objective}
        />
      )}

      {createCompanyObjectiveDialog}

      {editModal.open && editModal.objective && editModal.type === 'company' && (
        <AddObjectiveDialog
          type="company"
          open={editModal.open}
          onOpenChange={(open) => setEditModal({ open })}
          editObjective={editModal.objective}
          onObjectiveAdded={() => {
            logger.debug('✅ Company objective updated successfully');
            setEditModal({ open: false });
          }}
        />
      )}

      {editModal.open && editModal.objective && editModal.type === 'individual' && (
        <ModalAddIndividualContribution
          open={editModal.open}
          onOpenChange={(open) => setEditModal({ open })}
          organizationId={organizationId}
          cycleId={cycleId || filteredCycleIds?.[0] || ''}
          cycleIds={cycleIds ?? filteredCycleIds}
          editObjective={editModal.objective}
          onSuccess={() => {
            logger.debug('✅ Individual objective updated successfully');
            setEditModal({ open: false });
          }}
        />
      )}

      {editModal.open && editModal.objective && editModal.type === 'department' && (
        <ModalAddDepartmentContribution
          open={editModal.open}
          onOpenChange={(open) => setEditModal({ open })}
          organizationId={organizationId}
          cycleId={cycleId || ''}
          editObjective={editModal.objective}
          onSuccess={() => {
            logger.debug('✅ Department objective updated successfully');
            setEditModal({ open: false });
          }}
        />
      )}
    </>
  );
};