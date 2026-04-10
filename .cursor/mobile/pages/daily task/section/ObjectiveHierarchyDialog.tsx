import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { Input } from '@/features/ui/input';
import { Badge } from '@/features/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/ui/accordion';
import { Search, Building2, Users, Check, Target, ChevronDown, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/mobile/components/ui/skeleton';
import { useCompanyObjectives } from '@/features/2-8-dashboard/hooks/useCompanyObjectives';
import { useDepartmentObjectives } from '@/features/1_home/components/HomeOKRDashboard/modal/useDepartmentObjectives';
import { useIndividualObjectives } from '@/features/1_home/components/HomeOKRDashboard/modal/useIndividualObjectives';
import { Progress } from '@/features/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/mobile/hooks/use-mobile';

interface CompanyObjective {
  id: string;
  title: string;
  status: string;
  progress_percentage?: number;
  department_objectives?: Array<{
    id: string;
    title: string;
    status: string;
    progress_percentage: number;
    weight: number;
  }>;
  key_results?: Array<{
    id: string;
    title: string;
    status: string;
    progress_percentage?: number;
  }>;
}

interface IndividualObjective {
  id: string;
  title: string;
  status: string;
  progress_percentage?: number;
  department_objective_id?: string | null;
  employee_id: string;
  employees?: { full_name: string };
}

interface ObjectiveHierarchyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (individualObjectiveId: string, context: {
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  }) => void;
  selectedObjectiveId?: string;
  organizationId: string;
  cycleIds: string[];
  planDate?: Date | null; // Optional plan date to filter cycles
}

export const ObjectiveHierarchyDialog: React.FC<ObjectiveHierarchyDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  selectedObjectiveId,
  organizationId,
  cycleIds,
  planDate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(selectedObjectiveId);
  const [expandedCompany, setExpandedCompany] = useState<string | undefined>(undefined);
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, string | undefined>>({});
  const isMobile = useIsMobile();

  // Same data source as desktop: fetch ALL company + department objectives, then filter client-side
  const { data: allCompanyObjectivesRaw = [], isLoading: isLoadingCompany } = useCompanyObjectives(
    organizationId,
    undefined
  );

  const { data: allDepartmentObjectivesRaw = [] } = useDepartmentObjectives(
    organizationId,
    undefined,
    false
  );

  // Filter by cycleIds client-side (same as desktop)
  const companyObjectivesRaw = React.useMemo(() => {
    if (!allCompanyObjectivesRaw || allCompanyObjectivesRaw.length === 0) return [];
    if (cycleIds.length === 0) return allCompanyObjectivesRaw;
    const validCycleIds = cycleIds.filter(id => id && typeof id === 'string');
    if (validCycleIds.length === 0) return allCompanyObjectivesRaw;
    return allCompanyObjectivesRaw.filter((co: any) =>
      co.cycle_id && validCycleIds.includes(co.cycle_id)
    );
  }, [allCompanyObjectivesRaw, cycleIds]);

  const departmentObjectivesRaw = React.useMemo(() => {
    if (!allDepartmentObjectivesRaw || allDepartmentObjectivesRaw.length === 0) return [];
    if (cycleIds.length === 0) return allDepartmentObjectivesRaw;
    const validCycleIds = cycleIds.filter(id => id && typeof id === 'string');
    if (validCycleIds.length === 0) return allDepartmentObjectivesRaw;
    return allDepartmentObjectivesRaw.filter((dept: any) =>
      dept.cycle_id && validCycleIds.includes(dept.cycle_id)
    );
  }, [allDepartmentObjectivesRaw, cycleIds]);

  // Build companyObjectives: attach departments to each company (same as desktop, with fallback to all depts)
  const companyObjectives = React.useMemo(() => {
    if (!companyObjectivesRaw || companyObjectivesRaw.length === 0) return [];
    const companyObjectiveIds = new Set(companyObjectivesRaw.map((co: any) => co.id));
    const deptByCompany = new Map<string, any[]>();
    departmentObjectivesRaw.forEach((dept: any) => {
      if (dept.company_objective_id && companyObjectiveIds.has(dept.company_objective_id)) {
        if (!deptByCompany.has(dept.company_objective_id)) deptByCompany.set(dept.company_objective_id, []);
        deptByCompany.get(dept.company_objective_id)!.push(dept);
      }
    });
    if (deptByCompany.size === 0) {
      allDepartmentObjectivesRaw.forEach((dept: any) => {
        if (dept.company_objective_id && companyObjectiveIds.has(dept.company_objective_id)) {
          if (!deptByCompany.has(dept.company_objective_id)) deptByCompany.set(dept.company_objective_id, []);
          deptByCompany.get(dept.company_objective_id)!.push(dept);
        }
      });
    }
    return companyObjectivesRaw.map((co: any) => ({
      ...co,
      department_objectives: deptByCompany.get(co.id) || [],
      key_results: deptByCompany.get(co.id) || [],
    }));
  }, [companyObjectivesRaw, departmentObjectivesRaw, allDepartmentObjectivesRaw]);

  // Individual objectives: filtered by cycle + fallback to all (same as desktop)
  const { data: individualObjectivesFiltered = [], isLoading: isLoadingIndividualFiltered } = useIndividualObjectives(
    organizationId,
    cycleIds
  );
  const { data: individualObjectivesAll = [] } = useIndividualObjectives(organizationId, undefined);

  const departmentObjectiveIds = React.useMemo(() => {
    const ids = new Set<string>();
    companyObjectives.forEach((co: any) => {
      (co.department_objectives || co.key_results || []).forEach((dept: any) => ids.add(dept.id));
    });
    return ids;
  }, [companyObjectives]);

  const individualObjectives = React.useMemo(() => {
    const result = [...individualObjectivesFiltered];
    if (departmentObjectiveIds.size > 0 && individualObjectivesFiltered.length === 0) {
      individualObjectivesAll.forEach((indiv: any) => {
        if (indiv.department_objective_id && departmentObjectiveIds.has(indiv.department_objective_id)) {
          if (!result.find(r => r.id === indiv.id)) result.push(indiv);
        }
      });
    }
    if (result.length === 0) return individualObjectivesAll;
    return result;
  }, [individualObjectivesFiltered, individualObjectivesAll, departmentObjectiveIds]);

  const isLoadingIndividual = isLoadingIndividualFiltered;

  // Build hierarchy structure (same shape as before)
  const hierarchy = useMemo(() => {
    if (!companyObjectives || !individualObjectives) return [];

    const departmentMap = new Map<string, {
      id: string;
      title: string;
      status: string;
      progress_percentage: number;
      companyObjectiveId: string;
      individuals: IndividualObjective[];
    }>();

    type CompanyShape = CompanyObjective & { department_objectives?: unknown[]; key_results?: unknown[] };
    (companyObjectives as CompanyShape[]).forEach((company) => {
      const departments = company.department_objectives || company.key_results || [];
      departments.forEach((dept: { id: string; title: string; status?: string; progress_percentage?: number }) => {
        departmentMap.set(dept.id, {
          id: dept.id,
          title: dept.title,
          status: dept.status || 'active',
          progress_percentage: dept.progress_percentage || 0,
          companyObjectiveId: company.id,
          individuals: [],
        });
      });
    });

    individualObjectives.forEach((indiv) => {
      if (indiv.department_objective_id && departmentMap.has(indiv.department_objective_id)) {
        const dept = departmentMap.get(indiv.department_objective_id)!;
        dept.individuals.push(indiv);
      }
    });

    return (companyObjectives as CompanyShape[]).map((company) => {
      const departmentsData = company.department_objectives || company.key_results || [];
      const departments = departmentsData.map((dept: { id: string; title: string; status?: string; progress_percentage?: number }) => {
        const deptData = departmentMap.get(dept.id);
        return deptData || {
          id: dept.id,
          title: dept.title,
          status: dept.status || 'active',
          progress_percentage: dept.progress_percentage || 0,
          companyObjectiveId: company.id,
          individuals: [],
        };
      });
      return {
        id: company.id,
        title: company.title,
        status: company.status,
        progress_percentage: company.progress_percentage ?? 0,
        departments,
      };
    });
  }, [companyObjectives, individualObjectives]);

  // Get standalone Individual Objectives (without department)
  const standaloneObjectives = useMemo(() => {
    return individualObjectives.filter(
      (indiv) => !indiv.department_objective_id
    );
  }, [individualObjectives]);

  // Filter hierarchy based on search query
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return hierarchy;

    const query = searchQuery.toLowerCase();
    return hierarchy
      .map((company) => {
        const companyMatches = company.title.toLowerCase().includes(query);
        const departments = company.departments
          .map((dept) => {
            const deptMatches = dept.title.toLowerCase().includes(query);
            const individuals = dept.individuals.filter((indiv) =>
              indiv.title.toLowerCase().includes(query) ||
              indiv.employees?.full_name.toLowerCase().includes(query)
            );
            return {
              ...dept,
              individuals,
              deptMatches, // Store deptMatches in the object
            };
          })
          .filter((dept) => dept.deptMatches || dept.individuals.length > 0)
          .map(({ deptMatches, ...dept }) => dept); // Remove deptMatches before returning

        return {
          ...company,
          departments: departments.length > 0 || companyMatches ? departments : [],
        };
      })
      .filter((company) => company.departments.length > 0 || company.title.toLowerCase().includes(query));
  }, [hierarchy, searchQuery]);

  // Filter standalone objectives
  const filteredStandalone = useMemo(() => {
    if (!searchQuery.trim()) return standaloneObjectives;
    const query = searchQuery.toLowerCase();
    return standaloneObjectives.filter(
      (indiv) =>
        indiv.title.toLowerCase().includes(query) ||
        indiv.employees?.full_name.toLowerCase().includes(query)
    );
  }, [standaloneObjectives, searchQuery]);

  const handleCompanyChange = (value: string | undefined) => {
    setExpandedCompany(value);
    // Reset expanded department when company changes
    if (value) {
      setExpandedDepartments(prev => ({ ...prev, [value]: undefined }));
    }
  };

  const handleDepartmentChange = (companyId: string, value: string | undefined) => {
    setExpandedDepartments(prev => ({
      ...prev,
      [companyId]: value
    }));
  };

  const handleSelect = (indiv: IndividualObjective, companyTitle?: string, departmentTitle?: string) => {
    setSelectedId(indiv.id);
    onSelect(indiv.id, {
      companyTitle,
      departmentTitle,
      individualTitle: indiv.title,
    });
    onOpenChange(false);
  };

  const isLoading = isLoadingCompany || isLoadingIndividual;
  const hasData = hierarchy.length > 0 || standaloneObjectives.length > 0;
  const needsOrg = !organizationId || organizationId === '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        fullscreenAnimation={isMobile}
        className={cn(
          'max-w-none w-screen border-none md:border bg-card p-0 md:p-6 shadow-xl focus:outline-none flex flex-col gap-0 m-0 md:m-auto rounded-none md:rounded-lg translate-x-0 md:translate-x-[-50%] translate-y-0 md:translate-y-[-50%] left-0 md:left-[50%] top-0 md:top-[50%] overflow-hidden',
          isMobile ? 'fixed left-0 right-0 top-0 modal-above-safe-area' : 'h-screen',
          'md:w-[70vmin] md:h-[70vmin] md:max-w-[70vmin] md:max-h-[70vmin]'
        )}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3 md:px-0 md:pt-0 md:pb-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 md:text-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 -ml-2 md:ml-0 hover:bg-gray-100 flex-shrink-0"
              aria-label="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span>Select Individual Objective</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search Input - wrapper adds spacing and shadow as separator */}
        <div className="px-4 md:px-0 flex-shrink-0 pt-3 pb-3 shadow-[0_2px_6px_rgba(0,0,0,0.06)] bg-card z-10 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10 pointer-events-none" />
            <Input
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-3 text-sm md:text-base w-full"
            />
          </div>
        </div>

        {/* Content Area - full height, no gap to search bar or footer */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 md:px-0">
          {needsOrg ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : isLoading ? (
            <div className="space-y-3 py-2 md:py-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="ml-6 space-y-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center py-8 md:py-12">
              <Target className="h-10 w-10 md:h-12 md:w-12 text-gray-300 mb-3 md:mb-4" />
              <p className="text-xs md:text-sm font-medium text-gray-900 mb-1">No objectives available</p>
              <p className="text-xs text-gray-500">Please create individual objectives first</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4 py-2 md:py-0 overflow-x-hidden">
              {/* Company Objectives with Departments */}
              {filteredHierarchy.length > 0 && (
                <Accordion 
                  type="single" 
                  value={expandedCompany}
                  onValueChange={handleCompanyChange}
                  collapsible
                  className="w-full overflow-x-hidden"
                >
                  {filteredHierarchy.map((company) => (
                    <AccordionItem key={company.id} value={company.id} className="border-b border-gray-200 overflow-x-hidden">
                      <div className="overflow-x-hidden">
                        <AccordionTrigger className="hover:no-underline py-2 md:py-3 px-2 md:px-4 [&>svg]:hidden overflow-x-hidden w-full">
                          <div className="flex items-center gap-1.5 md:gap-2 w-full min-w-0 max-w-full overflow-x-hidden">
                            <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 flex-shrink-0" />
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 flex-shrink-0 whitespace-nowrap">
                              Company
                            </Badge>
                            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs md:text-sm font-medium text-gray-900 block text-left truncate w-full max-w-full">
                                      {company.title}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{company.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 transition-transform duration-200 text-gray-400 flex-shrink-0" />
                          </div>
                        </AccordionTrigger>
                        <div className="px-2 md:px-4 pb-1.5 md:pb-2">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <Progress 
                              value={company.progress_percentage || 0} 
                              className="flex-1 h-1.5 md:h-2 min-w-0"
                            />
                            <span className="text-[10px] md:text-xs font-medium text-gray-600 w-10 md:w-12 text-right flex-shrink-0">
                              {Math.round(company.progress_percentage || 0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <AccordionContent>
                        <div className="pl-3 md:pl-6 space-y-1.5 md:space-y-2 overflow-x-hidden">
                          {company.departments.length === 0 ? (
                            <p className="text-[10px] md:text-xs text-gray-500 italic">No departments yet</p>
                          ) : (
                            <Accordion 
                              type="single" 
                              value={expandedDepartments[company.id]}
                              onValueChange={(value) => handleDepartmentChange(company.id, value)}
                              collapsible
                              className="w-full overflow-x-hidden"
                            >
                              {company.departments.map((dept) => (
                                <AccordionItem key={dept.id} value={dept.id} className="border-b border-gray-100 overflow-x-hidden">
                                  <div className="overflow-x-hidden">
                                    <AccordionTrigger className="hover:no-underline py-1.5 md:py-2 px-2 md:px-4 [&>svg]:hidden overflow-x-hidden w-full">
                                      <div className="flex items-center gap-1.5 md:gap-2 w-full min-w-0 max-w-full overflow-x-hidden">
                                        <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-orange-600 flex-shrink-0" />
                                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 flex-shrink-0 whitespace-nowrap">
                                          Department
                                        </Badge>
                                        <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="text-xs md:text-sm text-gray-800 block text-left truncate w-full max-w-full">
                                                  {dept.title}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="max-w-xs">{dept.title}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 transition-transform duration-200 text-gray-400 flex-shrink-0" />
                                      </div>
                                    </AccordionTrigger>
                                    <div className="px-2 md:px-4 pb-1.5 md:pb-2">
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <Progress 
                                          value={dept.progress_percentage || 0} 
                                          className="flex-1 h-1.5 md:h-2 min-w-0"
                                        />
                                        <span className="text-[10px] md:text-xs font-medium text-gray-600 w-10 md:w-12 text-right flex-shrink-0">
                                          {Math.round(dept.progress_percentage || 0)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <AccordionContent>
                                    <div className="pl-2 md:pl-6 space-y-1 md:space-y-1.5 pr-1 md:pr-0">
                                      {dept.individuals.length === 0 ? (
                                        <p className="text-[10px] md:text-xs text-gray-500 italic">No individual objectives yet</p>
                                      ) : (
                                        dept.individuals.map((indiv) => (
                                          <button
                                            key={indiv.id}
                                            onClick={() => handleSelect(indiv, company.title, dept.title)}
                                            className={cn(
                                              "w-full text-left p-1.5 md:p-2 rounded-md border transition-colors",
                                              "hover:bg-blue-50 hover:border-blue-300",
                                              selectedId === indiv.id
                                                ? "bg-blue-100 border-blue-600 border-2"
                                                : "bg-white border-gray-200"
                                            )}
                                            style={{ maxWidth: 'calc(100% - 0.25rem)' }}
                                          >
                                            <div className="space-y-1.5 md:space-y-2">
                                              {/* Title row with badge and title */}
                                              <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 flex-shrink-0">
                                                  Individual
                                                </Badge>
                                                <div className="flex-1 min-w-0 pr-2 md:pr-10">
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <span className="text-xs md:text-sm font-medium text-gray-900 block text-left truncate">
                                                          {indiv.title}
                                                        </span>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p className="max-w-xs">{indiv.title}</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                </div>
                                                {selectedId === indiv.id && (
                                                  <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 flex-shrink-0" />
                                                )}
                                              </div>
                                              
                                              {/* Employee name */}
                                              {indiv.employees?.full_name && (
                                                <div className="text-[10px] md:text-xs text-gray-500">
                                                  👤 {indiv.employees.full_name}
                                                </div>
                                              )}
                                              
                                              {/* Progress bar - full width */}
                                              <div className="flex items-center gap-1.5 md:gap-2">
                                                <Progress 
                                                  value={indiv.progress_percentage || 0} 
                                                  className="flex-1 h-1 md:h-1.5 min-w-0"
                                                />
                                                <span className="text-[10px] md:text-xs font-medium text-gray-600 w-8 md:w-10 text-right flex-shrink-0">
                                                  {Math.round(indiv.progress_percentage || 0)}%
                                                </span>
                                              </div>
                                              
                                              {/* Description - hidden on mobile to save space */}
                                              <div className="text-[10px] md:text-xs text-gray-400 hidden md:block">
                                                📍 {company.title} → {dept.title} → {indiv.title}
                                              </div>
                                            </div>
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {/* Standalone Individual Objectives */}
              {filteredStandalone.length > 0 && (
                <div className="border-t border-gray-200 pt-3 md:pt-4">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                    <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-600" />
                    <h3 className="text-xs md:text-sm font-semibold text-gray-900">Standalone Individual Objectives</h3>
                  </div>
                  <div className="space-y-1 md:space-y-1.5 pr-1 md:pr-0">
                    {filteredStandalone.map((indiv) => (
                      <button
                        key={indiv.id}
                        onClick={() => handleSelect(indiv)}
                        className={cn(
                          "w-full text-left p-1.5 md:p-2 rounded-md border transition-colors",
                          "hover:bg-blue-50 hover:border-blue-300",
                          selectedId === indiv.id
                            ? "bg-blue-100 border-blue-600 border-2"
                            : "bg-white border-gray-200"
                        )}
                        style={{ maxWidth: 'calc(100% - 0.25rem)' }}
                      >
                        <div className="space-y-1.5 md:space-y-2">
                          {/* Title row with badge and title */}
                          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 flex-shrink-0">
                              Individual
                            </Badge>
                            <div className="flex-1 min-w-0 pr-2 md:pr-10">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs md:text-sm font-medium text-gray-900 block text-left truncate">
                                      {indiv.title}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{indiv.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            {selectedId === indiv.id && (
                              <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* Employee name */}
                          {indiv.employees?.full_name && (
                            <div className="text-[10px] md:text-xs text-gray-500">
                              👤 {indiv.employees.full_name}
                            </div>
                          )}
                          
                          {/* Progress bar - full width */}
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <Progress 
                              value={indiv.progress_percentage || 0} 
                              className="flex-1 h-1 md:h-1.5 min-w-0"
                            />
                            <span className="text-[10px] md:text-xs font-medium text-gray-600 w-8 md:w-10 text-right flex-shrink-0">
                              {Math.round(indiv.progress_percentage || 0)}%
                            </span>
                          </div>
                          
                          {/* Description - hidden on mobile to save space */}
                          <div className="text-[10px] md:text-xs text-gray-400 italic hidden md:block">
                            (No Department)
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results after search */}
              {filteredHierarchy.length === 0 && filteredStandalone.length === 0 && searchQuery.trim() && (
                <div className="flex flex-col items-center justify-center py-6 md:py-8">
                  <Search className="h-6 w-6 md:h-8 md:w-8 text-gray-300 mb-2" />
                  <p className="text-xs md:text-sm text-gray-500">No objectives found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t bg-muted/30 mt-auto z-10 relative md:border-t-0 md:shadow-[0_-2px_6px_rgba(0,0,0,0.06)] md:bg-card">
          <div className="px-4 pt-3 pb-3 md:p-0 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full md:w-auto">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

