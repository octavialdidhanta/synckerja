import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Building, Plus, Target, ChevronRight, ChevronDown, CheckCircle, Users, TrendingUp, Calendar, User, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useReportOkrTabStatus } from '@/1-home/context/HomeOkrTabsLoadContext';
import { useReportOkrPageDetail } from '@/1-OKR/context/OkrPageDetailLoadContext';
import { useFilteredObjectives } from './useFilteredObjectives';
import { useDepartments } from './CompanyObjectivesDetailViewImport/useDepartments';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { CreateIndividualObjectiveModal } from './DepartmentObjectivesViewImport/CreateIndividualObjectiveModal';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { getEmployeeStatus } from '@/2-1-employees/utils/employeeUtils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { WeeklyCheckinForm } from './DepartmentObjectivesViewImport/WeeklyCheckinDialog';
import { ObjectiveCheckinForm } from './CompanyObjectivesDetailViewImport/ObjectiveCheckinForm';
// TODO: Already using ModalAddDepartmentContribution, can remove this
// import { ModalCreateObjective } from '@/components/1_home/components/ModalCreateObjective';
import { CreateKeyResultDialog } from './CompanyObjectivesDetailViewImport/CreateKeyResultDialog';
import { ModalAddDepartmentContribution } from '../../modal/ModalAddDepartmentContribution';

import { DepartmentObjectivesEmptyState } from './DepartmentObjectivesViewImport/DepartmentObjectivesEmptyState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useDepartmentObjectives, useDeleteDepartmentObjective } from '../../modal/useDepartmentObjectives';
import { useIndividualObjectives } from '../../modal/useIndividualObjectives';
import { useDepartmentAsKeyResult } from './DepartmentObjectivesViewImport/useDepartmentAsKeyResult';
import { toast } from 'sonner';
import { useEffect } from 'react';
interface DepartmentObjectivesViewProps {
  organizationId: string;
  cycleId?: string;
  cycleIds?: string[]; // Support for multiple cycle IDs
}
export const DepartmentObjectivesView = ({
  organizationId,
  cycleId,
  cycleIds
}: DepartmentObjectivesViewProps) => {
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedObjective, setExpandedObjective] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [createKRDialog, setCreateKRDialog] = useState<{
    open: boolean;
    objective?: any;
  }>({
    open: false
  });

  // Edit Modal states
  const [editModal, setEditModal] = useState<{
    open: boolean;
    objective?: any;
  }>({
    open: false
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Individual objectives modal states
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  // Get department objectives from the dedicated table
  const finalCycleIds = cycleIds && cycleIds.length > 0 ? cycleIds : cycleId ? [cycleId] : undefined;
  const {
    data: departmentObjectives = [],
    isLoading: loadingObjectives,
    error: departmentObjectivesError,
  } = useDepartmentObjectives(organizationId, finalCycleIds, true); // Include individual objectives
  const {
    departments = [],
    isLoading: loadingDepartments,
    error: departmentsError,
  } = useDepartments(organizationId);
  const { data: employees = [], isPending: employeesPending } = useEmployees();

  const activeEmployees = useMemo(() => {
    return employees.filter(emp => {
      const status = getEmployeeStatus(emp);
      return status?.toLowerCase() !== 'terminated';
    });
  }, [employees]);

  // Get individual objectives ONLY for the specific department objectives
  // This prevents data sharing and improves performance
  const {
    data: individualObjectives = [],
    isPending: individualObjectivesPending,
  } = useIndividualObjectives(organizationId, finalCycleIds);
  const {
    user: currentUser
  } = useCurrentUser();

  const deleteObjective = useDeleteDepartmentObjective();

  // Filter department objectives by department for each department
  const departmentTabLoading =
    loadingObjectives ||
    loadingDepartments ||
    employeesPending ||
    individualObjectivesPending;
  const departmentTabError =
    (departmentObjectivesError as Error | null | undefined) ||
    (departmentsError as Error | null | undefined) ||
    null;
  const departmentTabErr =
    departmentTabError instanceof Error
      ? departmentTabError
      : departmentTabError
        ? new Error(String(departmentTabError))
        : null;
  useReportOkrTabStatus('department', departmentTabLoading, departmentTabErr);
  useReportOkrPageDetail('department', departmentTabLoading, departmentTabErr);

  // Helper function to get employee name by ID (only from active employees)
  const getEmployeeName = (employeeId: string) => {
    const employee = activeEmployees.find(emp => emp.id === employeeId || emp.user_id === employeeId);
    return employee?.full_name || 'Unknown Employee';
  };

  // Helper function to get individual objectives for a department objective
  // Only return objectives that are directly linked to this department objective
  const getIndividualObjectivesForDepartment = (departmentObjectiveId: string) => {
    return individualObjectives.filter(indObj => 
      indObj.department_objective_id === departmentObjectiveId
    );
  };

  // Hook to get correct progress for individual objectives with key results
  const useIndividualObjectiveProgress = (individualObjectiveId: string) => {
    return useQuery({
      queryKey: ['individual-objective-progress', individualObjectiveId],
      queryFn: async () => {
        const { data: keyResults, error } = await supabase
          .from('key_results')
          .select('current_value, target_value, progress_percentage, metric_type')
          .eq('individual_objective_id', individualObjectiveId)
          .limit(1);

        if (error) return 0;

        if (keyResults && keyResults.length > 0) {
          const keyResult = keyResults[0];
          // Use the progress_percentage from key_results as it's more accurate
          return keyResult.progress_percentage || 0;
        }

        return 0;
      },
      enabled: !!individualObjectiveId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };

  // Component to display individual objective with correct progress
  const IndividualObjectiveCard = ({ indObj }: { indObj: any }) => {
    const { data: correctProgress = 0, isLoading: progressLoading } = useIndividualObjectiveProgress(indObj.id);
    
    return (
      <div key={indObj.id} className="bg-success-muted border border-primary/20 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{indObj.title}</span>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs bg-accent text-success-foreground border-primary/25">
              {progressLoading ? '...' : `${Math.round(correctProgress)}%`}
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-600">
              Individual
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-gray-600">Progress</div>
          <Progress 
            value={correctProgress} 
            className="h-2"
          />
        </div>
        <div className="mt-2 text-xs text-gray-600">
          {getEmployeeName(indObj.employee_id)}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Start: {new Date(indObj.start_date).toLocaleDateString()}</span>
          <span>End: {new Date(indObj.end_date).toLocaleDateString()}</span>
        </div>
      </div>
    );
  };

  // Helper function to get synced progress for department objective
  const getSyncedProgress = (objective: any) => {
    // Always use the progress_percentage directly from database
    return objective.progress_percentage || 0;
  };
  const toggleDepartment = (departmentId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (expandedDepartments.has(departmentId)) {
      newExpanded.delete(departmentId);
    } else {
      newExpanded.add(departmentId);
    }
    setExpandedDepartments(newExpanded);
  };
  // Remove this function - accordion behavior will be handled by Accordion component
  const getObjectivesByDepartmentAndStatus = () => {
    const grouped = new Map<string, Map<string, any[]>>();
    departmentObjectives.forEach(obj => {
      const deptId = obj.department_id || 'no-department';
      const status = obj.status;
      if (!grouped.has(deptId)) {
        grouped.set(deptId, new Map());
      }
      const deptGroup = grouped.get(deptId)!;
      if (!deptGroup.has(status)) {
        deptGroup.set(status, []);
      }
      deptGroup.get(status)!.push(obj);
    });
    return grouped;
  };
  const getDepartmentName = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    return department?.name || 'Unknown Department';
  };
  const handleCreateKR = (objective: any) => {
    setCreateKRDialog({
      open: true,
      objective: {
        ...objective,
        level: 'department' // Ensure level is set for CreateKeyResultDialog
      }
    });
  };
  const openDepartmentContributionModal = (departmentId: string) => {
    if (!departmentId) {
      toast.error('No department selected');
      return;
    }
    setSelectedDepartmentId(departmentId);
    setShowContributionModal(true);
  };

  const handleCreateObjective = (departmentId: string) => {
    openDepartmentContributionModal(departmentId);
  };

  const handleAddContribution = (departmentId: string) => {
    openDepartmentContributionModal(departmentId);
  };

  // Individual objectives functions
  const handleCreateIndividualObjective = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsCreateModalOpen(true);
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
    return individualObjectives.filter(obj => obj.employee_id === employeeId);
  };
  const handleDeleteObjective = (e: React.MouseEvent, objectiveId: string) => {
    e.stopPropagation(); // Prevent accordion toggle
    if (confirm('Are you sure you want to delete this objective?')) {
      deleteObjective.mutate(objectiveId);
    }
  };

  const handleEditObjective = (e: React.MouseEvent, objective: any) => {
    e.stopPropagation(); // Prevent accordion toggle
    setEditModal({
      open: true,
      objective
    });
  };

  if (departmentTabLoading) {
    return null;
  }
  const objectivesByDepartmentAndStatus = getObjectivesByDepartmentAndStatus();
  const renderObjectiveCard = (objective: any, departmentId: string, status: string, borderColor: string, iconColor: string) => {
    const syncedProgress = getSyncedProgress(objective);
    return <AccordionItem key={objective.id} value={objective.id} className={`border-l-4 ${borderColor} shadow-sm mb-2 last:mb-0`}>
        <AccordionTrigger className="py-0 px-0 hover:bg-gray-50 transition-colors [&>svg]:hidden">
          <div className="w-full">
            {/* Header Section */}
            <div className="px-4 py-3">
              {/* Title Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1">
                  <Building className={`h-4 w-4 ${iconColor}`} />
                  <span className="text-sm font-medium text-gray-900 truncate text-left">
                    {objective.title}
                  </span>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div
                    onClick={(e) => handleEditObjective(e, objective)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center cursor-pointer rounded"
                    title="Edit objective"
                  >
                    <Edit className="h-3 w-3" />
                  </div>
                  <div
                    onClick={(e) => handleDeleteObjective(e, objective.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer rounded"
                    title="Delete objective"
                  >
                    <Trash2 className="h-3 w-3" />
                  </div>
                  {/* Custom Expand/Collapse Arrow */}
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expandedObjective === objective.id ? 'rotate-180' : ''}`} />
                </div>
              </div>
              
            </div>

            {/* Weekly Check-in Button with Progress Info */}
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                <ObjectiveCheckinForm 
                  objectiveId={objective.id} 
                  objectiveTitle={objective.title} 
                  objectiveType="department"
                  disableActivitiesTab={true} 
                  trigger={<div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 text-blue-600 h-7 px-3 text-xs cursor-pointer">
                      <Calendar className="h-3 w-3 mr-1" />
                      Weekly Check-in
                    </div>} 
                  onSuccess={() => {
                    // console.log('✅ Weekly OKR check-in saved successfully');
                  }} 
                />
                <Badge variant="outline" className="text-xs">
                  {(() => {
                    const keyResultsCount = objective.key_results?.length || 0;
                    const individualObjsCount = getIndividualObjectivesForDepartment(objective.id).length;
                    return keyResultsCount + individualObjsCount;
                  })()} KRs
                </Badge>
                <Badge variant="outline" className={`text-xs ${status === 'active' ? 'bg-success-muted text-success-foreground border-primary/20' : status === 'draft' ? 'bg-neutral-muted text-neutral-status border-border' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Completed'}
                </Badge>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-blue-600 font-medium">Average Progress</span>
                <span className="text-sm font-medium text-blue-600">{Math.round(syncedProgress || 0)}%</span>
              </div>
            </div>
            
            {/* Progress Bar - Full Width with padding */}
            <div className="px-4 w-full">
              <Progress value={syncedProgress || 0} className="h-2 w-full" />
            </div>

            {/* Why Important Section */}
            {objective.why_important && objective.why_important.trim() && (
              <div className="bg-blue-50 p-3 mx-4 rounded-lg mt-3 mb-3">
                <h5 className="font-medium text-xs text-blue-900 mb-1 uppercase tracking-wide">
                  Why this is important:
                </h5>
                <p className="text-xs text-blue-800">
                  {objective.why_important}
                </p>
              </div>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
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
             
             {(() => {
              // Get all key results (from key_results table)
              const keyResults = objective.key_results || [];
              
              // Get individual objectives for this department objective
              const individualObjs = getIndividualObjectivesForDepartment(objective.id);
              
              // Convert individual objectives to key result format for display
              const individualAsKeyResults = individualObjs.map((indObj: any) => ({
                id: indObj.id,
                title: indObj.title,
                current_value: indObj.progress_percentage || 0,
                target_value: 100,
                progress_percentage: indObj.progress_percentage || 0,
                unit: '%',
                metric_type: 'percentage',
                source_type: 'individual_objective'
              }));
              
              // Combine key results and individual objectives
              const allKeyResults = [...keyResults, ...individualAsKeyResults];
              
              if (allKeyResults.length > 0) {
                return (
                  <div className="space-y-2">
                    {/* Display key results from key_results table */}
                    {keyResults.map((kr: any) => (
                      <div key={kr.id} className="bg-info-muted border border-primary/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{kr.title}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {kr.progress_percentage || 0}%
                            </Badge>
                            <ObjectiveCheckinForm 
                              objectiveId={objective.id} 
                              objectiveTitle={objective.title} 
                              objectiveType="department"
                              trigger={<div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 px-2 text-xs cursor-pointer">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Check-in
                                </div>} 
                              onSuccess={() => {
                                // console.log('✅ KR weekly check-in saved successfully');
                              }} 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-primary font-medium">Progress</span>
                            <span className="text-foreground font-medium">
                              {kr.current_value || 0} / {kr.target_value} {kr.unit || ''}
                            </span>
                          </div>
                          <Progress value={kr.progress_percentage || 0} className="h-2 bg-muted" />
                        </div>
                      </div>
                    ))}
                    
                    {/* Display Individual Objectives as Key Results */}
                    {individualObjs.length > 0 && (
                      <>
                        {keyResults.length > 0 && (
                          <div className="text-xs text-gray-600 mb-2 italic mt-4">
                            Individual Objectives contributing to this Department Objective:
                          </div>
                        )}
                        {individualObjs.map((indObj: any) => (
                          <IndividualObjectiveCard key={indObj.id} indObj={indObj} />
                        ))}
                      </>
                    )}
                  </div>
                );
              } else {
                return (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4">
                    <p className="text-sm text-gray-500 text-center">No key results or individual objectives yet</p>
                    <Button variant="outline" size="sm" onClick={() => handleCreateKR(objective)} className="mt-2 w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Key Result
                    </Button>
                  </div>
                );
              }
            })()}
          </div>
        </AccordionContent>
      </AccordionItem>;
  };

  // Check if there are any objectives at all
  const hasAnyObjectives = departments.some(department => {
    const departmentObjectivesMap = objectivesByDepartmentAndStatus.get(department.id) || new Map();
    const activeObjectives = departmentObjectivesMap.get('active') || [];
    const draftObjectives = departmentObjectivesMap.get('draft') || [];
    const completedObjectives = departmentObjectivesMap.get('completed') || [];
    return activeObjectives.length > 0 || draftObjectives.length > 0 || completedObjectives.length > 0;
  });

  // Show empty state if no departments have any objectives
  if (!hasAnyObjectives) {
    return (
      <>
        <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-6 text-center dark:bg-muted/30">
          <div className="mb-4 flex items-center space-x-2">
            <Building className="h-8 w-8 text-gray-400 dark:text-muted-foreground" />
            <Target className="h-8 w-8 text-gray-400 dark:text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-foreground">No department objectives</h3>
          <p className="mb-6 max-w-md text-center text-sm text-gray-600 dark:text-muted-foreground">
            Start building department objectives by creating a new one or contributing to company objectives.
          </p>
          <div className="flex space-x-3">
            <Button
              onClick={() => openDepartmentContributionModal(departments[0]?.id ?? "")}
              size="sm"
              className="gap-2"
              disabled={departments.length === 0}
            >
              <Plus className="h-4 w-4" />
              Create Objective
            </Button>
            <Button
              onClick={() => openDepartmentContributionModal(departments[0]?.id ?? "")}
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={departments.length === 0}
            >
              <Target className="h-4 w-4" />
              Add Contribution
            </Button>
          </div>
        </div>

        <ModalAddDepartmentContribution
          open={showContributionModal}
          onOpenChange={setShowContributionModal}
          organizationId={organizationId}
          cycleId={finalCycleIds?.[0] || cycleId || ""}
          cycleIds={finalCycleIds}
          departmentId={selectedDepartmentId}
          onSuccess={() => setShowContributionModal(false)}
        />
      </>
    );
  }
  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 w-full flex-col">
        <div className="min-h-0 flex-1 space-y-2 pb-1">
              {departments.filter(department => {
                // Filter out departments that are actually organization names
                const orgNamePatterns = [
                  'PT Softorb Technology Indonesia',
                  'Softorb Technology',
                  'Softorb',
                  'Technology Indonesia'
                ];
                return !orgNamePatterns.some(pattern => 
                  department.name.toLowerCase().includes(pattern.toLowerCase())
                );
              }).map(department => {
              const departmentObjectivesMap = objectivesByDepartmentAndStatus.get(department.id) || new Map();
              const activeObjectives = departmentObjectivesMap.get('active') || [];
              const draftObjectives = departmentObjectivesMap.get('draft') || [];
              const completedObjectives = departmentObjectivesMap.get('completed') || [];
              const totalObjectives = activeObjectives.length + draftObjectives.length + completedObjectives.length;
              return <div key={department.id} className="border border-gray-200 rounded-lg w-full">
                <Collapsible open={expandedDepartments.has(department.id)} onOpenChange={() => toggleDepartment(department.id)}>
                  <CollapsibleTrigger asChild>
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors w-full">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3 flex-1">
                          {expandedDepartments.has(department.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          <Building className="h-4 w-4 text-primary" />
                          <span className="font-medium text-gray-900">{department.name}</span>
                          <Badge variant="outline" className="text-xs bg-info-muted text-primary border-primary/20">
                            {totalObjectives} Objectives
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {/* Three Dots Dropdown Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={e => {
                                e.stopPropagation();
                                handleCreateObjective(department.id);
                              }} className="flex items-center">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Objective
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => {
                                e.stopPropagation();
                                handleAddContribution(department.id);
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
                      {totalObjectives === 0 ? <DepartmentObjectivesEmptyState departmentName={department.name} onCreateObjective={() => handleCreateObjective(department.id)} onAddContribution={() => handleAddContribution(department.id)} /> : <div className="space-y-4">
                          {/* Active Objectives */}
                          {activeObjectives.length > 0 && <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-gray-900">Active</span>
                                <Badge variant="outline" className="text-xs bg-success-muted text-success-foreground border-primary/20">
                                  {activeObjectives.length}
                                </Badge>
                              </div>
                              <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                {activeObjectives.map(objective => renderObjectiveCard(objective, department.id, 'active', 'border-l-primary', 'text-primary'))}
                              </Accordion>
                            </div>}

                          {/* Draft Objectives */}
                          {draftObjectives.length > 0 && <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-gray-900">Draft</span>
                                <Badge variant="outline" className="text-xs bg-neutral-muted text-neutral-status border-border">
                                  {draftObjectives.length}
                                </Badge>
                              </div>
                              <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                {draftObjectives.map(objective => renderObjectiveCard(objective, department.id, 'draft', 'border-l-muted-foreground', 'text-muted-foreground'))}
                              </Accordion>
                            </div>}

                          {/* Completed Objectives */}
                          {completedObjectives.length > 0 && <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">Completed</span>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  {completedObjectives.length}
                                </Badge>
                              </div>
                               <Accordion type="single" collapsible value={expandedObjective} onValueChange={setExpandedObjective} className="space-y-2">
                                 {completedObjectives.map(objective => renderObjectiveCard(objective, department.id, 'completed', 'border-l-blue-500', 'text-blue-600'))}
                               </Accordion>
                             </div>}

                          {/* Individual Objectives Section */}
                          
                        </div>}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>;
            })}
        </div>
      </div>
      
      <ModalAddDepartmentContribution 
        open={showContributionModal} 
        onOpenChange={setShowContributionModal} 
        organizationId={organizationId} 
        cycleId={finalCycleIds?.[0] || cycleId || ''} 
        cycleIds={finalCycleIds} 
        departmentId={selectedDepartmentId}
        onSuccess={() => setShowContributionModal(false)}
      />
      
      {/* Debug logging for cycle IDs - moved to useEffect above */}

      {/* Create Key Result Dialog */}
      {createKRDialog.open && createKRDialog.objective && <CreateKeyResultDialog open={createKRDialog.open} onOpenChange={open => setCreateKRDialog({
      open
    })} objective={createKRDialog.objective} />}


      {/* Create Individual Objective Modal */}
      {selectedEmployee && <CreateIndividualObjectiveModal open={isCreateModalOpen} onOpenChange={open => {
      setIsCreateModalOpen(open);
      if (!open) {
        setSelectedEmployee(null);
      }
    }} organizationId={organizationId} cycleId={cycleId || ''} employeeId={selectedEmployee} employeeName={activeEmployees.find(emp => emp.id === selectedEmployee)?.full_name || 'Unknown Employee'} onSuccess={() => {}} />}

      {/* Edit Department Objective Modal */}
      {editModal.open && editModal.objective && (
        <ModalAddDepartmentContribution
          open={editModal.open}
          onOpenChange={(open) => setEditModal({ open })}
          organizationId={organizationId}
          cycleId={cycleId || ''}
          departmentId={editModal.objective.department_id}
          editObjective={editModal.objective}
          onSuccess={() => setEditModal({ open: false })}
        />
      )}
    </>
  );
};