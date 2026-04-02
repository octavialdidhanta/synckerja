import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Calendar, CheckCircle, Target, Lock, Save, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useUnifiedProfile } from '@/shared/hooks/useUnifiedProfile';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { supabase } from '@/shared/lib/supabaseClient';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { ActivitiesTab } from '../DepartmentObjectivesViewImport/ActivitiesTab';
import { DailyTaskProvider } from '@/8-2-DailyTask/context/DailyTaskContext';
import { BlockerDisplay } from '@/8-2-DailyTask/section/BlockerDisplay';
interface WeeklyPeriod {
  weekStart: Date;
  weekEnd: Date;
  displayText: string;
  isCurrentWeek: boolean;
  isEditable: boolean;
  isFuture: boolean;
}
interface CheckinData {
  id?: string;
  progress_percentage: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  comments: string;
  blockers: string;
  hasChanges: boolean;
}
interface ObjectiveCheckinFormProps {
  trigger?: React.ReactNode;
  objectiveId: string;
  objectiveTitle: string;
  objectiveType?: 'individual' | 'department' | 'company';
  onSuccess?: () => void;
  disableActivitiesTab?: boolean;
}
export const ObjectiveCheckinForm = ({
  trigger,
  objectiveId,
  objectiveTitle,
  objectiveType = 'individual',
  onSuccess,
  disableActivitiesTab = false
}: ObjectiveCheckinFormProps) => {
  const { data: unifiedData } = useUnifiedProfile();
  const profile = unifiedData ? { ...unifiedData.profile, ...unifiedData.profileDetails } : null;
  const {
    data: employee
  } = useCurrentUserEmployee();
  const {
    toast
  } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [weeklyPeriods, setWeeklyPeriods] = useState<WeeklyPeriod[]>([]);
  const [checkinData, setCheckinData] = useState<Record<string, CheckinData>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cycleData, setCycleData] = useState<{
    start_date: string;
    end_date: string;
  } | null>(null);
  const [keyResultData, setKeyResultData] = useState<{
    target_value: number;
    current_value: number;
    unit: string;
    metric_type: string;
    id: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('checkins');

  // Load OKR cycle data
  const loadCycleData = async () => {
    if (!profile?.active_organization_id) return;
    try {
      // Try to get objective from the three hierarchy tables
      let objective;

      // First try company_objectives
      const {
        data: companyData,
        error: companyError
      } = await supabase.from('company_objectives').select('cycle_id').eq('id', objectiveId);
      
      if (!companyError && companyData && companyData.length > 0) {
        objective = companyData[0];
      } else {
        // Try department_objectives
        const {
          data: deptData,
          error: deptError
        } = await supabase.from('department_objectives').select('cycle_id').eq('id', objectiveId);
        
        if (!deptError && deptData && deptData.length > 0) {
          objective = deptData[0];
        } else {
          // Try individual_objectives
          const {
            data: indivData,
            error: indivError
          } = await supabase.from('individual_objectives').select('cycle_id').eq('id', objectiveId);
          
          if (!indivError && indivData && indivData.length > 0) {
            objective = indivData[0];
          } else {
            console.error('Error loading objective from all tables:', companyError, deptError, indivError);
            return;
          }
        }
      }

      // Then get the cycle data
      const {
        data: cycle,
        error: cycleError
      } = await supabase.from('okr_cycles').select('start_date, end_date').eq('id', objective.cycle_id).single();
      if (cycleError || !cycle) {
        console.error('Error loading cycle:', cycleError);
        return;
      }
      setCycleData(cycle);
    } catch (error) {
      console.error('Error loading cycle data:', error);
    }
  };

  // Generate weekly periods based on cycle dates (Saturday to Friday)
  const generateWeeklyPeriods = (): WeeklyPeriod[] => {
    if (!cycleData) return [];
    const periods: WeeklyPeriod[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycleStart = new Date(cycleData.start_date);
    const cycleEnd = new Date(cycleData.end_date);

    // Find the first Saturday on or before cycle start
    let currentSaturday = new Date(cycleStart);
    const dayOfWeek = currentSaturday.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToSaturday = dayOfWeek === 0 ? 1 : (7 - dayOfWeek + 6) % 7; // Days to go back to Saturday
    currentSaturday.setDate(cycleStart.getDate() - daysToSaturday);
    currentSaturday.setHours(0, 0, 0, 0);

    // Generate all weeks from cycle start to cycle end
    while (currentSaturday <= cycleEnd) {
      const weekStart = new Date(currentSaturday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const isCurrentWeek = today >= weekStart && today <= weekEnd;
      const isFuture = weekStart > today;
      const isEditable = weekStart <= today; // Only current and past weeks are editable, future weeks are locked

      periods.push({
        weekStart,
        weekEnd,
        displayText: `${weekStart.getDate().toString().padStart(2, '0')} ${weekStart.toLocaleDateString('id-ID', {
          month: 'short'
        })} ${weekStart.getFullYear()} - ${weekEnd.getDate().toString().padStart(2, '0')} ${weekEnd.toLocaleDateString('id-ID', {
          month: 'short'
        })} ${weekEnd.getFullYear()}`,
        isCurrentWeek,
        isEditable,
        isFuture
      });

      // Move to next Saturday
      currentSaturday.setDate(currentSaturday.getDate() + 7);
    }
    return periods.reverse(); // Show newest first
  };

  // Get week key for storing data
  const getWeekKey = (weekStart: Date): string => {
    return weekStart.toISOString().split('T')[0];
  };

  // Load existing check-ins
  const loadExistingCheckins = async () => {
    if (!profile?.active_organization_id || !employee?.id) return;
    try {
      // Find key results using the correct hierarchy structure
      let keyResults = null;
      let krError = null;

      // First, determine which type of objective this is by checking which table it exists in
      const {
        data: companyObj
      } = await supabase.from('company_objectives').select('id').eq('id', objectiveId).maybeSingle();
      const {
        data: deptObj
      } = await supabase.from('department_objectives').select('id').eq('id', objectiveId).maybeSingle();
      const {
        data: indivObj
      } = await supabase.from('individual_objectives').select('id').eq('id', objectiveId).maybeSingle();

      // Now search for key results using the appropriate column
      if (companyObj) {
        // For company objectives, use department objectives as key results
        const {
          data: deptObjectives,
          error: deptObjError
        } = await supabase.from('department_objectives').select('id, title, progress_percentage, weight, description').eq('company_objective_id', objectiveId).limit(1);

        // Convert department objectives to key result format
        if (deptObjectives && deptObjectives.length > 0) {
          keyResults = deptObjectives.map(dept => ({
            id: dept.id,
            title: dept.title,
            target_value: 100, // Department objectives are percentage-based
            current_value: dept.progress_percentage || 0,
            unit: '%',
            metric_type: 'percentage'
          }));
        }
        krError = deptObjError;
      } else if (deptObj) {
        // For department objectives, prioritize actual key results from key_results table
        // (these have the correct target_value, metric_type, unit, etc.)
        const {
          data: deptKeyResults,
          error: deptKRError
        } = await supabase
          .from('key_results')
          .select('id, title, target_value, current_value, unit, metric_type, progress_percentage')
          .eq('department_objective_id', objectiveId)
          .limit(1);
        
        if (deptKeyResults && deptKeyResults.length > 0) {
          // Use actual key results from key_results table
          keyResults = deptKeyResults;
          krError = null;
        } else {
          // Fallback: use individual objectives as key results (for display purposes)
          // (same as how they're displayed in the UI)
          const {
            data: indivObjectives,
            error: indivObjError
          } = await supabase
            .from('individual_objectives')
            .select('id, title, progress_percentage, weight, description')
            .eq('department_objective_id', objectiveId)
            .limit(1);
          
          // Convert individual objectives to key result format
          if (indivObjectives && indivObjectives.length > 0) {
            keyResults = indivObjectives.map(indiv => ({
              id: indiv.id,
              title: indiv.title,
              target_value: 100, // Individual objectives are percentage-based
              current_value: indiv.progress_percentage || 0,
              unit: '%',
              metric_type: 'percentage',
              progress_percentage: indiv.progress_percentage || 0
            }));
            krError = null;
          } else {
            keyResults = null;
            krError = deptKRError || indivObjError;
          }
        }
      } else if (indivObj) {
        const {
          data: indivKRs,
          error: indivKRError
        } = await supabase.from('key_results').select('id, target_value, current_value, unit, title, metric_type, progress_percentage').eq('individual_objective_id', objectiveId).limit(1);
        keyResults = indivKRs;
        krError = indivKRError;
      } else {
        // No objective found in any hierarchy table
        console.log('Objective not found in any hierarchy table:', objectiveId);
        toast({
          title: 'Objective Not Found',
          description: 'This objective could not be found. Please refresh the page and try again.',
          variant: 'destructive'
        });
        setIsOpen(false);
        return;
      }

      // If no key results found for individual objectives, allow direct check-in
      if (krError || !keyResults || keyResults.length === 0) {
        console.log('No key results found for objective:', objectiveId);

        // For individual objectives, allow check-in without key results
        if (indivObj) {
          console.log('Individual objective detected - allowing direct check-in without key results');
          // Set dummy key result data for individual objectives
          setKeyResultData({
            target_value: 100, // Individual objectives are percentage-based
            current_value: 0,
            unit: '%',
            metric_type: 'percentage',
            id: objectiveId // Use the objective ID directly
          });

          // Load existing check-ins for individual objectives
          const {
            data: existingCheckins,
            error: checkinError
          } = await supabase.from('weekly_checkins').select('*').eq('organization_id', profile.active_organization_id).eq('employee_id', employee.id).eq('individual_objective_id', objectiveId);
          if (!checkinError && existingCheckins) {
            const checkinMap: Record<string, CheckinData> = {};
            existingCheckins.forEach(checkin => {
              const weekKey = checkin.week_start_date;
              checkinMap[weekKey] = {
                id: checkin.id,
                progress_percentage: checkin.current_value || 0,
                status: checkin.status || 'on_track',
                comments: checkin.comments || '',
                blockers: checkin.blockers || '',
                hasChanges: false
              };
            });
            setCheckinData(checkinMap);
          }
          return;
        }
        toast({
          title: 'No Key Results Found',
          description: 'This objective does not have key results to track. Please add key results first.',
          variant: 'destructive'
        });
        setIsOpen(false);
        return;
      }
      const keyResult = keyResults[0];
      const keyResultId = keyResult.id;
      console.log('🎯 Loading check-ins for Key Result:', {
        keyResultId,
        title: keyResult.title,
        objectiveId
      });

      // Set key result data for progress bar
      console.log('🔍 Key Result Data Debug:', {
        keyResult: {
          id: keyResult.id,
          title: keyResult.title,
          target_value: keyResult.target_value,
          current_value: keyResult.current_value,
          progress_percentage: keyResult.progress_percentage,
          metric_type: keyResult.metric_type,
          unit: keyResult.unit
        }
      });
      
      setKeyResultData({
        target_value: keyResult.target_value || 0,
        current_value: keyResult.current_value || 0,
        unit: keyResult.unit || '',
        metric_type: keyResult.metric_type || 'percentage',
        id: keyResultId
      });
      // Check if keyResultId is an individual objective (used as key result for department objective)
      const { data: isIndivAsKR } = await supabase
        .from('individual_objectives')
        .select('id')
        .eq('id', keyResultId)
        .maybeSingle();
      
      // Build query to find check-ins
      // If keyResultId is an individual objective, also search by individual_objective_id
      let checkinQuery = supabase
        .from('weekly_checkins')
        .select('*')
        .eq('organization_id', profile.active_organization_id)
        .eq('employee_id', employee.id);
      
      if (isIndivAsKR) {
        // For individual objectives used as key results, search by individual_objective_id
        checkinQuery = checkinQuery.or(`key_result_id.eq.${keyResultId},individual_objective_id.eq.${keyResultId},individual_objective_id.eq.${objectiveId}`);
      } else {
        // For regular key results, search normally
        checkinQuery = checkinQuery.or(`key_result_id.eq.${keyResultId},individual_objective_id.eq.${objectiveId}`);
      }
      
      const {
        data: existingCheckins,
        error
      } = await checkinQuery;
      if (error) {
        console.error('Error loading existing check-ins:', error);
        return;
      }
      const checkinMap: Record<string, CheckinData> = {};
      existingCheckins?.forEach(checkin => {
        const weekKey = checkin.week_start_date;
        
        // For numerical metrics, store the actual current_value
        // For percentage metrics, convert to percentage
        let progressValue = checkin.current_value || 0;
        if (keyResultData?.metric_type === 'number') {
          // For numerical metrics, store the actual value (e.g., 50000)
          progressValue = checkin.current_value || 0;
        } else {
          // For percentage metrics, convert to percentage (0-100)
          progressValue = checkin.current_value || 0;
        }
        
        checkinMap[weekKey] = {
          id: checkin.id,
          progress_percentage: progressValue,
          status: checkin.status || 'on_track',
          comments: checkin.comments || '',
          blockers: checkin.blockers || '',
          hasChanges: false
        };
      });
      setCheckinData(checkinMap);
    } catch (error) {
      console.error('Error loading check-ins:', error);
    }
  };

  // Initialize data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCycleData();
      setHasUnsavedChanges(false);
    }
  }, [isOpen, profile?.active_organization_id, objectiveId]);

  // Generate periods when cycle data is loaded
  useEffect(() => {
    if (cycleData) {
      const periods = generateWeeklyPeriods();
      setWeeklyPeriods(periods);
      loadExistingCheckins();
    }
  }, [cycleData, employee?.id]);

  // Update checkin data for a specific week
  const updateCheckinData = (weekKey: string, field: keyof CheckinData, value: any) => {
    setCheckinData(prev => {
      const current = prev[weekKey] || {
        progress_percentage: 0,
        status: 'on_track' as const,
        comments: '',
        blockers: '',
        hasChanges: false
      };
      const updated = {
        ...current,
        [field]: value,
        hasChanges: true
      };
      setHasUnsavedChanges(true);
      return {
        ...prev,
        [weekKey]: updated
      };
    });
  };

  // Save all changes
  const handleSaveAll = async () => {
    if (!profile?.active_organization_id || !employee?.id || !keyResultData?.id) {
      toast({
        title: 'Error',
        description: 'Unable to find organization, employee, or key result information',
        variant: 'destructive'
      });
      return;
    }
    try {
      // Use the dynamic key result ID from loaded data
      const keyResultId = keyResultData.id;
      console.log('💾 Saving check-ins for Key Result:', keyResultId);
      const changedWeeks = Object.entries(checkinData).filter(([_, data]) => data.hasChanges);
      if (changedWeeks.length === 0) {
        toast({
          title: 'Info',
          description: 'No changes to save'
        });
        return;
      }

      // Check if this is an individual objective (keyResultId === objectiveId)
      const isIndividualObjective = keyResultId === objectiveId;
      
      // Check if this is a department objective being used as key result for company objective
      const { data: deptObjCheck } = await supabase.from('department_objectives').select('id').eq('id', keyResultId).maybeSingle();
      const isDepartmentObjectiveAsKeyResult = keyResultId !== objectiveId && deptObjCheck;
      
      // Check if this is an individual objective being used as key result for department objective
      const { data: indivObjCheck } = await supabase.from('individual_objectives').select('id').eq('id', keyResultId).maybeSingle();
      const isIndividualObjectiveAsKeyResult = keyResultId !== objectiveId && indivObjCheck;
      
      // Check if this is an individual objective that has its own key results
      const { data: indivHasKeyResults } = await supabase.from('key_results').select('id').eq('individual_objective_id', objectiveId).maybeSingle();
      const isIndividualObjectiveWithKeyResults = indivHasKeyResults && keyResultId === objectiveId;
      
      // Determine the final objective type
      let finalObjectiveType = 'unknown';
      if (isIndividualObjective) {
        finalObjectiveType = 'individual_direct';
      } else if (isDepartmentObjectiveAsKeyResult) {
        finalObjectiveType = 'department_as_keyresult';
      } else if (isIndividualObjectiveAsKeyResult) {
        finalObjectiveType = 'individual_as_keyresult';
      }
      
      // Debug logging
      console.log('🔍 Objective Type Detection:', {
        keyResultId,
        objectiveId,
        isIndividualObjective,
        isDepartmentObjectiveAsKeyResult,
        isIndividualObjectiveAsKeyResult,
        finalObjectiveType,
        deptObjCheck,
        indivObjCheck
      });
      for (const [weekKey, data] of changedWeeks) {
        // Debug logging for progress values
        console.log('🔍 Progress Value Debug:', {
          weekKey,
          originalValue: data.progress_percentage,
          safeValue: Math.min(Math.max(data.progress_percentage, 0), 100),
          finalObjectiveType
        });
        
        if (isIndividualObjective) {
          // For individual objectives, update the objective's progress directly
          // Ensure progress_percentage is within database limits (0-100 for individual objectives)
          const safeProgressPercentage = Math.min(Math.max(data.progress_percentage, 0), 100);
          
          const {
            error: updateObjError
          } = await supabase.from('individual_objectives').update({
            progress_percentage: safeProgressPercentage,
            updated_at: new Date().toISOString()
          }).eq('id', objectiveId);
          if (updateObjError) {
            console.error('Error updating individual objective progress:', updateObjError);
            throw updateObjError;
          }

          // Also create weekly check-in records for individual objectives
          if (data.id) {
            // Update existing check-in
            const {
              error
            } = await supabase.from('weekly_checkins').update({
              current_value: data.progress_percentage,
              confidence_level: 8,
              // Default confidence level
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            }).eq('id', data.id);
            if (error) throw error;
          } else {
            // Create new check-in for individual objective
            const {
              error
            } = await supabase.from('weekly_checkins').insert({
              organization_id: profile.active_organization_id,
              individual_objective_id: objectiveId,
              employee_id: employee.id,
              week_start_date: weekKey,
              current_value: data.progress_percentage,
              confidence_level: 8,
              // Default confidence level
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            });
            if (error) throw error;
          }
          console.log('✅ Individual objective progress and weekly checkin updated');
        } else if (isDepartmentObjectiveAsKeyResult) {
          // For department objectives used as key results for company objectives
          // Ensure progress_percentage is within database limits (0-100 for department objectives)
          const safeProgressPercentage = Math.min(Math.max(data.progress_percentage, 0), 100);
          
          const {
            error: updateDeptError
          } = await supabase.from('department_objectives').update({
            progress_percentage: safeProgressPercentage,
            updated_at: new Date().toISOString()
          }).eq('id', keyResultId);
          if (updateDeptError) {
            console.error('Error updating department objective progress:', updateDeptError);
            throw updateDeptError;
          }

          // Also create weekly check-in records for department objectives
          if (data.id) {
            // Update existing check-in
            const {
              error
            } = await supabase.from('weekly_checkins').update({
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            }).eq('id', data.id);
            if (error) throw error;
          } else {
            // Create new check-in for department objective
            const {
              error
            } = await supabase.from('weekly_checkins').insert({
              organization_id: profile.active_organization_id,
              department_objective_id: keyResultId,
              employee_id: employee.id,
              week_start_date: weekKey,
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            });
            if (error) throw error;
          }
          console.log('✅ Department objective progress and weekly checkin updated');
        } else if (isIndividualObjectiveWithKeyResults) {
          // For individual objectives that have their own key results
          // Check if this is a numerical metric - if so, update key_results.current_value instead of progress_percentage
          const isNumericalMetric = keyResultData?.metric_type === 'number';
          
          if (isNumericalMetric) {
            // For numerical metrics, update key_results.current_value (no constraint limits)
            const {
              error: updateKeyResultError
            } = await supabase.from('key_results').update({
              current_value: data.progress_percentage, // Use original value for numerical metrics
              updated_at: new Date().toISOString()
            }).eq('individual_objective_id', objectiveId);
            if (updateKeyResultError) {
              console.error('Error updating key result current_value:', updateKeyResultError);
              throw updateKeyResultError;
            }
          } else {
            // For percentage metrics, update individual_objectives.progress_percentage (0-100 constraint)
            const safeProgressPercentage = Math.min(Math.max(data.progress_percentage, 0), 100);
            const {
              error: updateIndivError
            } = await supabase.from('individual_objectives').update({
              progress_percentage: safeProgressPercentage,
              updated_at: new Date().toISOString()
            }).eq('id', objectiveId);
            if (updateIndivError) {
              console.error('Error updating individual objective progress:', updateIndivError);
              throw updateIndivError;
            }
          }
          
          if (data.id) {
            // Update existing check-in
            const {
              error
            } = await supabase.from('weekly_checkins').update({
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            }).eq('id', data.id);
            if (error) throw error;
          } else {
            // Create new check-in for individual objective
            const {
              error
            } = await supabase.from('weekly_checkins').insert({
              organization_id: profile.active_organization_id,
              individual_objective_id: objectiveId,
              employee_id: employee.id,
              week_start_date: weekKey,
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            });
            if (error) throw error;
          }
          console.log('✅ Individual objective with key results progress and weekly checkin updated');
        } else if (isIndividualObjectiveAsKeyResult) {
          // For individual objectives used as key results for department objectives
          // Check if this is a numerical metric - if so, update key_results.current_value instead of progress_percentage
          const isNumericalMetric = keyResultData?.metric_type === 'number';
          
          if (isNumericalMetric) {
            // For numerical metrics, update key_results.current_value (no constraint limits)
            const {
              error: updateKeyResultError
            } = await supabase.from('key_results').update({
              current_value: data.progress_percentage, // Use original value for numerical metrics
              updated_at: new Date().toISOString()
            }).eq('id', keyResultId);
            if (updateKeyResultError) {
              console.error('Error updating key result current_value:', updateKeyResultError);
              throw updateKeyResultError;
            }
          } else {
            // For percentage metrics, update individual_objectives.progress_percentage (0-100 constraint)
            const safeProgressPercentage = Math.min(Math.max(data.progress_percentage, 0), 100);
            const {
              error: updateIndivError
            } = await supabase.from('individual_objectives').update({
              progress_percentage: safeProgressPercentage,
              updated_at: new Date().toISOString()
            }).eq('id', keyResultId);
            if (updateIndivError) {
              console.error('Error updating individual objective progress:', updateIndivError);
              throw updateIndivError;
            }
          }

          // Also create weekly check-in records for individual objectives
          if (data.id) {
            // Update existing check-in
            const {
              error
            } = await supabase.from('weekly_checkins').update({
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            }).eq('id', data.id);
            if (error) throw error;
          } else {
            // Create new check-in for individual objective
            const {
              error
            } = await supabase.from('weekly_checkins').insert({
              organization_id: profile.active_organization_id,
              individual_objective_id: keyResultId,
              employee_id: employee.id,
              week_start_date: weekKey,
              current_value: data.progress_percentage,
              confidence_level: 8,
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            });
            if (error) throw error;
          }
          console.log('✅ Individual objective progress and weekly checkin updated');
        } else {
          // Regular key result flow for company/department objectives
          if (data.id) {
            // Update existing check-in
            const {
              error
            } = await supabase.from('weekly_checkins').update({
              current_value: data.progress_percentage,
              confidence_level: 8,
              // Default confidence level
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            }).eq('id', data.id);
            if (error) throw error;
          } else {
            // Create new check-in
            const {
              error
            } = await supabase.from('weekly_checkins').insert({
              organization_id: profile.active_organization_id,
              key_result_id: keyResultId,
              employee_id: employee.id,
              week_start_date: weekKey,
              current_value: data.progress_percentage,
              confidence_level: 8,
              // Default confidence level
              status: data.status,
              comments: data.comments,
              blockers: data.blockers
            });
            if (error) throw error;
          }
        }
      }

      // Mark all as saved
      setCheckinData(prev => {
        const updated = {
          ...prev
        };
        Object.keys(updated).forEach(key => {
          updated[key] = {
            ...updated[key],
            hasChanges: false
          };
        });
        return updated;
      });
      setHasUnsavedChanges(false);
      toast({
        title: 'Success',
        description: 'All check-ins saved successfully'
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving check-ins:', error);
      toast({
        title: 'Error',
        description: 'Failed to save check-ins',
        variant: 'destructive'
      });
    }
  };

  // Handle dialog close with unsaved changes
  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      toast({
        title: 'Unsaved Changes',
        description: 'Please save your changes before closing',
        variant: 'destructive'
      });
      return;
    }
    setIsOpen(open);
  };

  // Get progress indicator for a week compared to previous week
  const getProgressIndicator = (weekKey: string, currentProgress: number) => {
    const weekIndex = weeklyPeriods.findIndex(period => getWeekKey(period.weekStart) === weekKey);
    if (weekIndex === -1 || weekIndex === weeklyPeriods.length - 1) return null;
    const previousWeekKey = getWeekKey(weeklyPeriods[weekIndex + 1].weekStart);
    const previousData = checkinData[previousWeekKey];
    if (!previousData || previousData.progress_percentage === 0) return null;
    const diff = currentProgress - previousData.progress_percentage;
    if (diff > 0) {
      return <TrendingUp className="h-3 w-3 text-primary" />;
    } else if (diff < 0) {
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    } else {
      return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };
  const defaultTrigger = <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
      <Calendar className="h-4 w-4 mr-2" />
      Check-in
    </div>;
  return <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="w-[92vw] h-[90vh] max-w-[1400px] max-h-[900px] overflow-hidden flex flex-col p-6 pb-0">
        <DialogHeader className="shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Weekly Check-in History
            <span className="text-sm font-normal text-muted-foreground ml-2">
              - {objectiveTitle}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Weekly periods run from Saturday to Friday. Current and past weeks can be edited.
          </DialogDescription>
          
          {/* Progress Bar Section */}
          {keyResultData && (
            <div className="mt-4 rounded-lg border border-border bg-accent p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800">Progress Overview</span>
                <span className="text-sm font-medium text-primary bg-white px-2 py-1 rounded-md">
                  {(() => {
                    // Get the latest current value from weekly check-ins
                    const latestCheckin = Object.values(checkinData).reduce((latest, current) => {
                      if (!latest || current.progress_percentage > latest.progress_percentage) {
                        return current;
                      }
                      return latest;
                    }, null as CheckinData | null);
                    
                    const currentValue = latestCheckin?.progress_percentage || (keyResultData.metric_type === 'number' ? keyResultData.current_value : keyResultData.progress_percentage) || 0;
                    
                    if (keyResultData?.metric_type === 'number') {
                      // For numerical metrics, currentValue is the actual value (e.g., 100)
                      return `${currentValue} / ${keyResultData?.target_value || 0} ${keyResultData?.unit || ''}`;
                    } else {
                      // For percentage metrics, currentValue is already a percentage (0-100)
                      return `${Math.round((currentValue / (keyResultData?.target_value || 1)) * 100)} / 100 %`;
                    }
                  })()}
                </span>
              </div>
              <Progress 
                value={(() => {
                  const latestCheckin = Object.values(checkinData).reduce((latest, current) => {
                    if (!latest || current.progress_percentage > latest.progress_percentage) {
                      return current;
                    }
                    return latest;
                  }, null as CheckinData | null);
                  
                  const currentValue = latestCheckin?.progress_percentage || (keyResultData?.metric_type === 'number' ? keyResultData?.current_value : keyResultData?.progress_percentage) || 0;
                  
                  if (keyResultData?.metric_type === 'number') {
                    // For numerical metrics, calculate percentage: (currentValue / targetValue) * 100
                    return keyResultData?.target_value > 0 ? (currentValue / keyResultData.target_value) * 100 : 0;
                  } else {
                    // For percentage metrics, currentValue is already a percentage (0-100)
                    return keyResultData?.target_value > 0 ? (currentValue / keyResultData.target_value) * 100 : 0;
                  }
                })()} 
                className="h-3 bg-white border border-primary/20" 
              />
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>{keyResultData?.metric_type === 'number' ? `0 ${keyResultData?.unit || ''}` : '0%'}</span>
                <span className="font-medium">
                  {(() => {
                    const latestCheckin = Object.values(checkinData).reduce((latest, current) => {
                      if (!latest || current.progress_percentage > latest.progress_percentage) {
                        return current;
                      }
                      return latest;
                    }, null as CheckinData | null);
                    
                    const currentValue = latestCheckin?.progress_percentage || keyResultData?.current_value;
                    return `${Math.round((currentValue / (keyResultData?.target_value || 1)) * 100)}% Complete`;
                  })()}
                </span>
                <span>{keyResultData?.metric_type === 'number' ? `${keyResultData?.target_value || 0} ${keyResultData?.unit || ''}` : '100%'}</span>
              </div>
            </div>
          )}
        </DialogHeader>
        
        {/* Tabs Container */}
        <Tabs defaultValue="checkins" value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col mt-6">
          <TabsList className="grid w-full grid-cols-2 shrink-0 mb-6 bg-gray-100 p-1 rounded-lg h-12">
            <TabsTrigger 
              value="checkins" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium transition-all duration-200"
            >
              <Calendar className="h-4 w-4" />
              Weekly Check-ins
            </TabsTrigger>
            <TabsTrigger 
              value="activities" 
              disabled={disableActivitiesTab}
              className={`flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium transition-all duration-200 ${disableActivitiesTab ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Activity className="h-4 w-4" />
              Activities
              {disableActivitiesTab && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="checkins" className="flex-1 min-h-0 flex flex-col data-[state=inactive]:hidden">
            {/* Scrollable Content with Fixed Headers */}
            <div className="flex-1 min-h-0 flex flex-col relative bg-white rounded-lg border border-gray-200 shadow-sm">
              {/* Fixed Header Row */}
              <div className="shrink-0 z-10 bg-gray-50 border-b border-gray-200 rounded-t-lg">
            <div className="flex gap-4 text-sm font-semibold text-gray-700 p-4">
              <div className="w-44 shrink-0">Week Period</div>
              <div className="w-24 shrink-0">Progress</div>
              <div className="w-32 shrink-0">Status</div>
              <div className="flex-1 min-w-52">Comments</div>
              <div className="flex-1 min-w-52">Blockers</div>
            </div>
              </div>
              
              {/* Scrollable Content - fills remaining space so footer stays visible */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="divide-y divide-gray-100">
              {weeklyPeriods.map(period => {
                  const weekKey = getWeekKey(period.weekStart);
                  const data = checkinData[weekKey] || {
                    progress_percentage: 0,
                    status: 'on_track' as const,
                    comments: '',
                    blockers: '',
                    hasChanges: false
                  };
                  return (
                    <div key={weekKey} className={`flex items-center gap-4 py-3 px-4 transition-colors duration-150 ${
                      period.isCurrentWeek 
                        ? 'border-l-4 border-l-primary bg-info-muted' 
                        : period.isFuture 
                        ? 'bg-gray-50/80' 
                        : 'hover:bg-gray-50/60'
                    } ${!period.isEditable ? 'opacity-60' : ''}`}>
                      
                      {/* Week Period */}
                      <div className="w-44 shrink-0 flex items-center gap-2">
                        <div className="text-sm flex-1">
                          <div className="font-medium text-gray-800 mb-1">{period.displayText}</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {period.isCurrentWeek && <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-accent text-primary">Current</Badge>}
                            {period.isFuture && <Badge variant="outline" className="h-5 border-primary/20 px-2 text-[10px] text-primary">Future</Badge>}
                            {!period.isEditable && <Lock className="h-3 w-3 text-gray-400" />}
                            {data.hasChanges && <Badge variant="outline" className="text-[10px] h-5 px-2 text-warning-foreground border-warning-muted bg-warning-muted">
                                Unsaved
                              </Badge>}
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-24 shrink-0 flex items-center gap-2">
                        <Input 
                          type="number" 
                          min="0" 
                          max={keyResultData?.metric_type === 'number' ? undefined : 100} 
                          value={data.progress_percentage || ''} 
                          onChange={e => {
                            const value = e.target.value === '' ? 0 : Number(e.target.value);
                            updateCheckinData(weekKey, 'progress_percentage', value);
                          }} 
                          disabled={!period.isEditable} 
                          className={`h-9 text-sm border-gray-300 focus:border-primary focus:ring-primary ${!period.isEditable ? 'bg-gray-100' : 'bg-white'}`} 
                          placeholder="0" 
                        />
                        {getProgressIndicator(weekKey, data.progress_percentage)}
                      </div>

                      {/* Status */}
                      <div className="w-32 shrink-0">
                        <Select value={data.status} onValueChange={(value: 'on_track' | 'at_risk' | 'off_track') => updateCheckinData(weekKey, 'status', value)} disabled={!period.isEditable}>
                          <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-primary ${!period.isEditable ? 'bg-gray-100' : 'bg-white'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg">
                            <SelectItem value="on_track">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                                <span className="text-sm">On Track</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="at_risk">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-sm">At Risk</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="off_track">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-sm">Off Track</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Comments */}
                      <div className="flex-1 min-w-52">
                        <Textarea 
                          placeholder="Comments..." 
                          value={data.comments} 
                          onChange={e => updateCheckinData(weekKey, 'comments', e.target.value)} 
                          disabled={!period.isEditable} 
                          className={`min-h-9 resize-none border-gray-300 text-sm focus:border-primary focus:ring-primary ${!period.isEditable ? 'bg-gray-100' : 'bg-white'}`} 
                          rows={1} 
                        />
                      </div>

                      {/* Blockers */}
                      <div className="flex-1 min-w-52">
                        {period.isEditable ? (
                          <BlockerDisplay
                            weekStart={period.weekStart.toISOString().split('T')[0]}
                            weekEnd={period.weekEnd.toISOString().split('T')[0]}
                            organizationId={profile.active_organization_id}
                            objectiveId={objectiveId}
                            objectiveType={objectiveType}
                            onBlockerUpdate={() => {
                              // Refresh data if needed
                            }}
                          />
                        ) : (
                          <Textarea 
                            placeholder="Blockers..." 
                            value={data.blockers} 
                            disabled={true}
                            className="min-h-9 text-sm border-gray-300 bg-gray-100 resize-none" 
                            rows={1} 
                          />
                        )}
                      </div>

                      {/* Actions - Hidden since we removed it from header but keep structure */}
                      <div className="w-4 shrink-0 flex justify-center">
                        {data.hasChanges && (
                          <div className="w-3 h-3 bg-warning-muted0 rounded-full animate-pulse shadow-sm"></div>
                        )}
                      </div>
                    </div>
                  );
                 })}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="activities" className="flex-1 min-h-0 flex flex-col mt-0 overflow-hidden data-[state=inactive]:hidden">
            <DailyTaskProvider>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <ActivitiesTab 
                  objectiveId={objectiveId}
                  objectiveTitle={objectiveTitle}
                />
              </div>
            </DailyTaskProvider>
          </TabsContent>
        </Tabs>

        {/* Fixed Footer - always visible at bottom of modal */}
        <footer className="flex-shrink-0 flex justify-between items-center py-2 px-4 border-t bg-gray-50/80 mt-auto">
          <div className="text-sm text-muted-foreground">
            {hasUnsavedChanges && <span className="text-warning-foreground">You have unsaved changes</span>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={hasUnsavedChanges}>
              {hasUnsavedChanges ? 'Save First' : 'Close'}
            </Button>
            {activeTab !== 'activities' && (
              <Button onClick={handleSaveAll} disabled={!hasUnsavedChanges} className="bg-primary hover:bg-primary">
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>;
};
