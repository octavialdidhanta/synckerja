import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';

const isDev = import.meta.env.DEV;

export interface MeetingPoint {
  id: string;
  meeting_date: string;
  discussion_point: string;
  request_by: string | null;
  status: string;
  updates: string | null;
  created_at: string;
  organization_id: string;
}

interface MeetingPointUpdate {
  id: string;
  meeting_point_solution_id: string;
  update_details: string;
  created_at: string;
  created_by: string | null;
  meeting_point_solutions?: {
    solution_description: string;
    meeting_point_id: string;
    meeting_point_issue_id: string;
    meeting_points?: { discussion_point: string };
  };
}

interface MeetingPointIssue {
  id: string;
  meeting_point_id: string;
  organization_id: string;
  issue_description: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface MeetingPointSolution {
  id: string;
  meeting_point_issue_id: string;
  meeting_point_id: string;
  organization_id: string;
  solution_description: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data from issue
  issue?: {
    issue_description: string;
  };
}

interface SummaryData {
  notStarted: number;
  onGoing: number;
  completed: number;
  rejected: number;
  presented: number;
  totalUpdates: number;
}

interface Filters {
  search: string;
  status: string;
  requestBy: string;
  timeFilter: string;
}

interface MeetingNotesContextType {
  meetingPoints: MeetingPoint[];
  summaryData: SummaryData;
  recentUpdates: MeetingPointUpdate[];
  filters: Filters;
  initialLoading: boolean;
  isLoading: boolean;
  setFilters: (filters: Filters | ((prev: Filters) => Filters)) => void;
  addMeetingPoint: (data: Partial<MeetingPoint>) => Promise<void>;
  updateMeetingPoint: (id: string, data: Partial<MeetingPoint>) => Promise<void>;
  deleteMeetingPoint: (id: string) => Promise<void>;
  getUpdateHistory: (solutionId: string) => Promise<MeetingPointUpdate[]>;
  getUpdateHistoryByMeetingPoint: (meetingPointId: string) => Promise<MeetingPointUpdate[]>;
  addUpdate: (solutionId: string, updateDetails: string, newStatus?: string) => Promise<void>;
  updateUpdate: (updateId: string, updateDetails: string) => Promise<void>;
  deleteUpdate: (updateId: string) => Promise<void>;
  getUpdateCount: (meetingPointId: string) => number;
  // Issues & Solutions functions
  getIssueHistory: (meetingPointId: string) => Promise<MeetingPointIssue[]>;
  addIssue: (meetingPointId: string, issueDescription: string) => Promise<void>;
  updateIssue: (issueId: string, issueDescription: string) => Promise<void>;
  updateIssueNotes: (issueId: string, notes: string) => Promise<void>;
  deleteIssue: (issueId: string) => Promise<void>;
  getSolutionHistory: (meetingPointId: string) => Promise<MeetingPointSolution[]>;
  addSolution: (issueId: string, meetingPointId: string, solutionDescription: string) => Promise<void>;
  updateSolution: (solutionId: string, solutionDescription: string) => Promise<void>;
  updateSolutionNotes: (solutionId: string, notes: string) => Promise<void>;
  deleteSolution: (solutionId: string) => Promise<void>;
  /** Refresh meeting points and recent updates (e.g. for pull-to-refresh). Does not set isLoading. */
  refreshMeetingPoints: () => Promise<void>;
}

const MeetingNotesContext = createContext<MeetingNotesContextType | undefined>(undefined);

export const useMeetingNotes = () => {
  const context = useContext(MeetingNotesContext);
  if (!context) {
    throw new Error('useMeetingNotes must be used within a MeetingNotesProvider');
  }
  return context;
};

interface MeetingNotesProviderProps {
  children: ReactNode;
}

export const MeetingNotesProvider = ({ children }: MeetingNotesProviderProps) => {
  const [meetingPoints, setMeetingPoints] = useState<MeetingPoint[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<MeetingPointUpdate[]>([]);
  const [issues, setIssues] = useState<MeetingPointIssue[]>([]);
  const [solutions, setSolutions] = useState<MeetingPointSolution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoadedOrgId, setLastLoadedOrgId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    requestBy: '',
    timeFilter: ''
  });
  const { toast } = useToast();
  const { organizationId, loading: organizationLoading } = useCurrentOrg();
  const isActiveRef = useRef(true);

  // Centralized fetch functions
  const fetchMeetingPoints = async () => {
    if (!organizationId) return;

    try {
      if (isDev) {
        logger.query('Fetching meeting points for organization:', organizationId);
      }
      
      const { data, error } = await supabase
        .from('meeting_points')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (isDev) {
        logger.query('Fetched meeting points:', data);
      }
      if (!isActiveRef.current) return;
      setMeetingPoints(data || []);
    } catch (error) {
      logger.error('Error fetching meeting points:', error);
      if (!isActiveRef.current) return;
      toast({
        title: 'Error',
        description: 'Failed to load meeting points',
        variant: 'destructive'
      });
    }
  };

  const fetchRecentUpdates = async () => {
    if (!organizationId) return;

    try {
      // First get all solutions for this organization's meeting points
      const { data: solutions, error: solutionsError } = await supabase
        .from('meeting_point_solutions')
        .select('id, meeting_point_id, meeting_points!inner(organization_id, discussion_point)')
        .eq('meeting_points.organization_id', organizationId);

      if (solutionsError) throw solutionsError;

      if (!solutions || solutions.length === 0) {
        if (!isActiveRef.current) return;
        setRecentUpdates([]);
        return;
      }

      const solutionIds = solutions.map(s => s.id);

      // Then get all updates for these solutions (include meeting_points.discussion_point for Recent Updates UI)
      const { data, error } = await supabase
        .from('meeting_point_updates')
        .select('*, meeting_point_solutions(meeting_point_id, meeting_points(discussion_point))')
        .in('meeting_point_solution_id', solutionIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!isActiveRef.current) return;
      setRecentUpdates(data || []);
    } catch (error) {
      logger.error('Error fetching recent updates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recent updates',
        variant: 'destructive'
      });
    }
  };

  // Calculate summary data from meeting points
  const summaryData: SummaryData = {
    notStarted: meetingPoints.filter(point => point.status === 'Not Started').length,
    onGoing: meetingPoints.filter(point => point.status === 'On Going').length,
    completed: meetingPoints.filter(point => point.status === 'Completed').length,
    rejected: meetingPoints.filter(point => point.status === 'Rejected').length,
    presented: meetingPoints.filter(point => point.status === 'Presented').length,
    totalUpdates: recentUpdates.length
  };

  const addMeetingPoint = async (data: Partial<MeetingPoint>) => {
    if (!organizationId) return;

    try {
      if (isDev) {
        logger.debug('Adding meeting point to database:', { ...data, organization_id: organizationId });
      }
      
      const { error } = await supabase
        .from('meeting_points')
        .insert({
          organization_id: organizationId,
          discussion_point: data.discussion_point || '',
          request_by: data.request_by || null,
          status: data.status || 'Not Started',
          meeting_date: data.meeting_date || new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      if (isDev) {
        logger.debug('Meeting point added successfully');
      }
      
      toast({
        title: 'Success',
        description: 'Meeting point added successfully'
      });
      
      // Refresh data immediately
      await fetchMeetingPoints();
    } catch (error) {
      logger.error('Error adding meeting point:', error);
      toast({
        title: 'Error',
        description: 'Failed to add meeting point',
        variant: 'destructive'
      });
    }
  };

  const updateMeetingPoint = async (id: string, data: Partial<MeetingPoint>) => {
    if (!organizationId) {
      toast({
        title: 'Error',
        description: 'Organization not loaded',
        variant: 'destructive'
      });
      return;
    }
    try {
      const { error } = await supabase
        .from('meeting_points')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Meeting point updated successfully'
      });
      
      // Refresh data immediately
      await fetchMeetingPoints();
    } catch (error) {
      logger.error('Error updating meeting point:', error);
      toast({
        title: 'Error',
        description: 'Failed to update meeting point',
        variant: 'destructive'
      });
    }
  };

  const deleteMeetingPoint = async (id: string) => {
    if (!organizationId) {
      toast({
        title: 'Error',
        description: 'Organization not loaded',
        variant: 'destructive'
      });
      return;
    }
    try {
      const { error } = await supabase
        .from('meeting_points')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Meeting point deleted successfully'
      });
      
      // Refresh data immediately
      await fetchMeetingPoints();
    } catch (error) {
      logger.error('Error deleting meeting point:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete meeting point',
        variant: 'destructive'
      });
    }
  };

  const getUpdateHistory = async (solutionId: string): Promise<MeetingPointUpdate[]> => {
    try {
      const { data, error } = await supabase
        .from('meeting_point_updates')
        .select('*')
        .eq('meeting_point_solution_id', solutionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching update history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load update history',
        variant: 'destructive'
      });
      return [];
    }
  };

  const getUpdateHistoryByMeetingPoint = async (meetingPointId: string): Promise<MeetingPointUpdate[]> => {
    try {
      // First get all solutions for this meeting point
      const { data: solutions, error: solutionsError } = await supabase
        .from('meeting_point_solutions')
        .select('id')
        .eq('meeting_point_id', meetingPointId);

      if (solutionsError) throw solutionsError;
      
      if (!solutions || solutions.length === 0) {
        return [];
      }

      const solutionIds = solutions.map(s => s.id);

      // Then get all updates for these solutions
      const { data, error } = await supabase
        .from('meeting_point_updates')
        .select('*')
        .in('meeting_point_solution_id', solutionIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching update history by meeting point:', error);
      toast({
        title: 'Error',
        description: 'Failed to load update history',
        variant: 'destructive'
      });
      return [];
    }
  };

  const addUpdate = async (solutionId: string, updateDetails: string, newStatus?: string) => {
    if (!organizationId) return;

    try {
      // First, get the solution to find the meeting_point_id
      const { data: solution, error: solutionError } = await supabase
        .from('meeting_point_solutions')
        .select('meeting_point_id')
        .eq('id', solutionId)
        .single();

      if (solutionError) throw solutionError;

      const { error } = await supabase
        .from('meeting_point_updates')
        .insert({
          meeting_point_solution_id: solutionId,
          update_details: updateDetails,
          organization_id: organizationId,
          created_by: (await supabase.auth.getUser()).data.user?.id || null
        });

      if (error) throw error;

      // Update meeting point status if provided, or auto-change to "On Going" if status is "Not Started"
      if (solution?.meeting_point_id) {
        const currentPoint = meetingPoints.find(p => p.id === solution.meeting_point_id);
        const statusToUpdate = newStatus || (currentPoint?.status === 'Not Started' ? 'On Going' : currentPoint?.status);
        
        if (statusToUpdate && statusToUpdate !== currentPoint?.status) {
          await updateMeetingPoint(solution.meeting_point_id, { status: statusToUpdate });
        }
      }

      // Refresh updates data
      await fetchRecentUpdates();

      toast({
        title: 'Success',
        description: 'Update added successfully'
      });
    } catch (error) {
      logger.error('Error adding update:', error);
      toast({
        title: 'Error',
        description: 'Failed to add update',
        variant: 'destructive'
      });
    }
  };

  const updateUpdate = async (updateId: string, updateDetails: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_updates')
        .update({ update_details: updateDetails })
        .eq('id', updateId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Update edited successfully'
      });

      // Refresh updates data
      await fetchRecentUpdates();
    } catch (error) {
      logger.error('Error updating update:', error);
      toast({
        title: 'Error',
        description: 'Failed to edit update',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteUpdate = async (updateId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Update deleted successfully'
      });

      // Refresh updates data
      await fetchRecentUpdates();
    } catch (error) {
      logger.error('Error deleting update:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete update',
        variant: 'destructive'
      });
      throw error;
    }
  };

  /** Count of updates for a meeting point from cached recentUpdates (max 20 total; not full DB count). */
  const getUpdateCount = useCallback((meetingPointId: string): number => {
    return recentUpdates.filter(update => {
      const solution = update.meeting_point_solutions;
      return solution?.meeting_point_id === meetingPointId;
    }).length;
  }, [recentUpdates]);

  // ========== ISSUES FUNCTIONS ==========
  const getIssueHistory = useCallback(async (meetingPointId: string): Promise<MeetingPointIssue[]> => {
    try {
      const { data, error } = await supabase
        .from('meeting_point_issues')
        .select('*')
        .eq('meeting_point_id', meetingPointId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching issue history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load issue history',
        variant: 'destructive'
      });
      return [];
    }
  }, []);

  const addIssue = async (meetingPointId: string, issueDescription: string) => {
    if (!organizationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('meeting_point_issues')
        .insert({
          meeting_point_id: meetingPointId,
          organization_id: organizationId,
          issue_description: issueDescription,
          created_by: user?.id || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Issue added successfully'
      });
    } catch (error) {
      logger.error('Error adding issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to add issue',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateIssue = async (issueId: string, issueDescription: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_issues')
        .update({ issue_description: issueDescription })
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Issue updated successfully'
      });
    } catch (error) {
      logger.error('Error updating issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to update issue',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateIssueNotes = async (issueId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_issues')
        .update({ notes: notes || null })
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Issue notes updated successfully'
      });
    } catch (error) {
      logger.error('Error updating issue notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to update issue notes',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteIssue = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Issue deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete issue',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // ========== SOLUTIONS FUNCTIONS ==========
  const getSolutionHistory = async (meetingPointId: string): Promise<MeetingPointSolution[]> => {
    try {
      const { data, error } = await supabase
        .from('meeting_point_solutions')
        .select(`
          *,
          issue:meeting_point_issues!meeting_point_issue_id(issue_description)
        `)
        .eq('meeting_point_id', meetingPointId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map((solution: any) => ({
        ...solution,
        issue: solution.issue ? { issue_description: solution.issue.issue_description } : undefined
      }));
    } catch (error) {
      logger.error('Error fetching solution history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load solution history',
        variant: 'destructive'
      });
      return [];
    }
  };

  const addSolution = async (issueId: string, meetingPointId: string, solutionDescription: string) => {
    if (!organizationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('meeting_point_solutions')
        .insert({
          meeting_point_issue_id: issueId,
          meeting_point_id: meetingPointId,
          organization_id: organizationId,
          solution_description: solutionDescription,
          created_by: user?.id || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Solution added successfully'
      });
    } catch (error) {
      logger.error('Error adding solution:', error);
      toast({
        title: 'Error',
        description: 'Failed to add solution',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateSolution = async (solutionId: string, solutionDescription: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_solutions')
        .update({ solution_description: solutionDescription })
        .eq('id', solutionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Solution updated successfully'
      });
    } catch (error) {
      logger.error('Error updating solution:', error);
      toast({
        title: 'Error',
        description: 'Failed to update solution',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateSolutionNotes = async (solutionId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_solutions')
        .update({ notes: notes || null })
        .eq('id', solutionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Solution notes updated successfully'
      });
    } catch (error) {
      logger.error('Error updating solution notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to update solution notes',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteSolution = async (solutionId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_point_solutions')
        .delete()
        .eq('id', solutionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Solution deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting solution:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete solution',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!organizationId) return;

    isActiveRef.current = true;

    // Initial data fetch
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMeetingPoints(), fetchRecentUpdates()]);
      if (!isActiveRef.current) return;
      setLastLoadedOrgId(organizationId);
      setIsLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const meetingPointsChannel = supabase
      .channel('meeting-points-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_points',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          if (!isActiveRef.current) return;
          if (isDev) {
            logger.realtime('Real-time meeting points update:', payload);
          }
          fetchMeetingPoints();
        }
      )
      .subscribe();

    const updatesChannel = supabase
      .channel('meeting-updates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_point_updates'
        },
        () => {
          if (!isActiveRef.current) return;
          fetchRecentUpdates();
          fetchMeetingPoints(); // Also refresh meeting points when updates change
        }
      )
      .subscribe();

    const issuesChannel = supabase
      .channel('meeting-issues-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_point_issues',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          // Refresh issues for all meeting points
          // Individual issues will be fetched on-demand when dialog opens
        }
      )
      .subscribe();

    const solutionsChannel = supabase
      .channel('meeting-solutions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_point_solutions',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          // Refresh solutions for all meeting points
          // Individual solutions will be fetched on-demand when dialog opens
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      isActiveRef.current = false;
      supabase.removeChannel(meetingPointsChannel);
      supabase.removeChannel(updatesChannel);
      supabase.removeChannel(issuesChannel);
      supabase.removeChannel(solutionsChannel);
    };
  }, [organizationId]);

  const refreshMeetingPoints = useCallback(async () => {
    await Promise.all([fetchMeetingPoints(), fetchRecentUpdates()]);
  }, []);

  const initialLoading =
    organizationLoading || (Boolean(organizationId) && lastLoadedOrgId !== organizationId);

  const value: MeetingNotesContextType = {
    meetingPoints,
    summaryData,
    recentUpdates,
    filters,
    initialLoading,
    isLoading,
    setFilters,
    addMeetingPoint,
    updateMeetingPoint,
    deleteMeetingPoint,
    getUpdateHistory,
    getUpdateHistoryByMeetingPoint,
    addUpdate,
    updateUpdate,
    deleteUpdate,
    getUpdateCount,
    // Issues & Solutions
    getIssueHistory,
    addIssue,
    updateIssue,
    updateIssueNotes,
    deleteIssue,
    getSolutionHistory,
    addSolution,
    updateSolution,
    updateSolutionNotes,
    deleteSolution,
    refreshMeetingPoints,
  };

  return (
    <MeetingNotesContext.Provider value={value}>
      {children}
    </MeetingNotesContext.Provider>
  );
};


