import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  History, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Flag, 
  MessageSquare, 
  Calendar,
  User,
  Zap,
  Target,
  FileText,
  AlertCircle,
  Info,
  XCircle,
  CheckSquare,
  GitBranch,
  X,
} from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { StepDependencyModal } from './StepDependencyModal';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface StepHistory {
  id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  blocker_type: string | null;
  blocker_severity: string | null;
  brief_type: string | null;
  created_at: string;
  created_by: string;
  task_steps_to_steps_id?: string | null;
  created_by_employee?: { id: string; full_name: string; email?: string };
  sub_step?: { id: string; title: string } | null;
}

interface StepHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskStepId: string;
  stepTitle: string;
  currentStatus: string;
  currentPriority: string;
  taskId?: string;
  subStepId?: string; // when provided, operate on sub-step history instead
  onHistoryUpdate?: () => void;
}

export const StepHistoryModal: React.FC<StepHistoryModalProps> = ({
  isOpen,
  onClose,
  taskStepId,
  stepTitle,
  currentStatus,
  currentPriority,
  taskId,
  subStepId,
  onHistoryUpdate
}) => {
  const [activeTab, setActiveTab] = useState('brief');
  const [history, setHistory] = useState<StepHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  
  // Blocker form state
  const [blockerType, setBlockerType] = useState('');
  const [blockerSeverity, setBlockerSeverity] = useState('');
  const [blockerDescription, setBlockerDescription] = useState('');
  
  // Brief form state
  const [briefType, setBriefType] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  
  // Status update form state
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [statusDescription, setStatusDescription] = useState('');
  
  // Priority update form state
  const [newPriority, setNewPriority] = useState(currentPriority);
  const [priorityDescription, setPriorityDescription] = useState('');
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchHistory = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      const base = (supabase as any)
        .from('task_step_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500); // Limit to prevent statement timeout

      // OPTIMIZATION: Add timeout protection (5 seconds)
      const historyPromise = subStepId
        ? base.eq('task_steps_to_steps_id', subStepId)
        : base.eq('task_step_id', taskStepId);

      const { data, error } = await Promise.race([
        historyPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('History fetch timeout')), 5000)
        )
      ]) as any;

      if (error) throw error;
      
      // Get unique user IDs from history
      const userIds = [...new Set((data || []).map((entry: any) => entry.created_by).filter(Boolean))];
      
      // Fetch employee data for these user IDs
      let employeesData = {};
      if (userIds.length > 0) {
        const { data: employees, error: empError } = await (supabase as any)
          .from('employees')
          .select('user_id, full_name, email')
          .in('user_id', userIds)
          .limit(100); // Limit to prevent statement timeout
        
        if (empError) {
          console.warn('Failed to fetch employees:', empError);
        } else {
          employeesData = employees?.reduce((acc: any, emp: any) => {
            acc[emp.user_id] = emp;
            return acc;
          }, {}) || {};
        }
      }

      // Get unique sub-step IDs from history
      const subStepIds = [...new Set((data || []).map((entry: any) => entry.task_steps_to_steps_id).filter(Boolean))];
      
      // Fetch sub-step data for these IDs
      let subStepsData = {};
      if (subStepIds.length > 0) {
        const { data: subSteps, error: subStepError } = await (supabase as any)
          .from('task_steps_to_steps')
          .select('id, title')
          .in('id', subStepIds)
          .limit(200); // Limit to prevent statement timeout
        
        if (subStepError) {
          console.warn('Failed to fetch sub-steps:', subStepError);
        } else {
          subStepsData = subSteps?.reduce((acc: any, sub: any) => {
            acc[sub.id] = sub;
            return acc;
          }, {}) || {};
        }
      }

      // Add employee data and sub-step data to history entries
      const historyWithEmployees = (data || []).map((entry: any) => ({
        ...entry,
        created_by_employee: employeesData[entry.created_by] || null,
        sub_step: entry.task_steps_to_steps_id ? subStepsData[entry.task_steps_to_steps_id] : null
      }));

      setHistory(historyWithEmployees);
    } catch (error: any) {
      console.error('Error fetching step history:', error);
      // Don't show toast when just opening modal - only log to console
      // Toast notifications should only appear for user actions (submits, updates, etc.)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isOpen, taskStepId, subStepId]);

  const addHistoryEntry = async (actionType: string, data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const insertPayload: any = {
        action_type: actionType,
        ...data,
        created_by: user.id,
      };
      if (subStepId) {
        // For sub-step history (especially blockers), set task_steps_to_steps_id
        insertPayload.task_steps_to_steps_id = subStepId;
        // IMPORTANT: For blockers from sub-steps, task_step_id should be NULL to avoid double display
        // For other action types (status_change, priority_change), we keep the parent step id
        if (actionType !== 'blocker_added') {
          insertPayload.task_step_id = taskStepId; // Keep parent step id for non-blocker actions
        }
        // For blocker_added from sub-step: task_step_id will be NULL (not set)
      } else {
        insertPayload.task_step_id = taskStepId;
      }

      const { error } = await (supabase as any)
        .from('task_step_history')
        .insert(insertPayload);

      if (error) throw error;

      // Update step status if needed
      if (!subStepId) {
        if (actionType === 'status_change') {
          // Synchronize is_completed with status
          // When status = 'completed', set is_completed = true
          // When status != 'completed', set is_completed = false
          // Note: completed_at is automatically handled by database trigger based on is_completed
          const updatePayload: any = {
            status: newStatus,
            is_completed: newStatus === 'completed',
            blocked_reason: newStatus === 'blocked' ? data.description : null,
            blocked_at: newStatus === 'blocked' ? new Date().toISOString() : null,
            started_at: newStatus === 'in_progress' ? new Date().toISOString() : null
          };

          const { error: updateError } = await (supabase as any)
            .from('task_steps')
            .update(updatePayload)
            .eq('id', taskStepId);

          if (updateError) throw updateError;
        }

        // Update step priority if needed
        if (actionType === 'priority_change') {
          const { error: updateError } = await (supabase as any)
            .from('task_steps')
            .update({ priority: newPriority })
            .eq('id', taskStepId);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: 'Success',
        description: 'Update recorded successfully!',
      });

      fetchHistory();
      onHistoryUpdate?.();
    } catch (error: any) {
      console.error('Error adding history entry:', error);
      toast({
        title: 'Error',
        description: `Failed to record update: ${error.message}`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleBlockerSubmit = async () => {
    if (!blockerType || !blockerSeverity || !blockerDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all blocker fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addHistoryEntry('blocker_added', {
        description: blockerDescription.trim(),
        blocker_type: blockerType,
        blocker_severity: blockerSeverity
      });

      // Reset form
      setBlockerType('');
      setBlockerSeverity('');
      setBlockerDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBriefSubmit = async () => {
    if (!briefType || !briefDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all brief fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addHistoryEntry('brief_update', {
        description: briefDescription.trim(),
        brief_type: briefType
      });

      // Reset form
      setBriefType('');
      setBriefDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!statusDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a description for the status change',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addHistoryEntry('status_change', {
        old_value: currentStatus,
        new_value: newStatus,
        description: statusDescription.trim()
      });

      // Reset form
      setStatusDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrioritySubmit = async () => {
    if (!priorityDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a description for the priority change',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addHistoryEntry('priority_change', {
        old_value: currentPriority,
        new_value: newPriority,
        description: priorityDescription.trim()
      });

      // Reset form
      setPriorityDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'blocker_added': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'blocker_resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'status_change': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'priority_change': return <Flag className="w-4 h-4 text-orange-500" />;
      case 'brief_update': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'comment_added': return <MessageSquare className="w-4 h-4 text-gray-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

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

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-gray-100 text-gray-700 border-gray-200',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
      blocked: 'bg-red-100 text-red-700 border-red-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return (
      <Badge className={`${variants[status as keyof typeof variants] || ''} px-2 py-1 text-xs`}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0 min-h-0 overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none h-dvh min-h-0 rounded-none modal-above-safe-area'
            : 'w-[720px] h-[720px] max-w-[95vw] max-h-[95vh]'
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile
              ? 'safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 px-0 py-0'
              : 'px-6 pt-6 pb-4'
          )}
        >
          <div className={cn('flex items-center gap-3', isMobile ? 'w-full min-w-0 gap-1.5 px-3 py-2' : '')}>
            <div className={cn('flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30 flex-shrink-0', isMobile ? 'h-9 w-9' : 'w-10 h-10 rounded-lg')}>
              <History className={cn('text-blue-600 dark:text-blue-400', isMobile ? 'h-4 w-4' : 'w-5 h-5')} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className={cn(isMobile ? 'm-0 truncate py-0 pr-1 text-base font-semibold leading-tight' : 'text-lg font-semibold truncate sm:text-xl')}>
                Step History & Updates
              </DialogTitle>
              <DialogDescription className={cn('text-muted-foreground truncate', isMobile ? 'mt-0.5 text-xs leading-tight' : 'text-sm sm:max-w-lg')}>
                {stepTitle}
              </DialogDescription>
            </div>
            {isMobile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="inline-flex h-9 w-9 shrink-0 rounded-full p-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div
          className={cn(
            'flex-1 min-h-0 overflow-hidden flex flex-col',
            isMobile ? 'px-6 pt-4 pb-6' : 'px-6 pb-6'
          )}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
            <div className="mb-4 w-full flex-shrink-0 overflow-x-auto">
              <TabsList className="flex gap-4 bg-transparent py-2 px-2 min-w-max !h-auto !items-start rounded-none">
                <TabsTrigger
                  value="brief"
                  className="group flex items-center gap-3 rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-500 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-600 transition">
                    <FileText className="w-4 h-4" />
                  </span>
                  Brief Updates
                </TabsTrigger>
                <TabsTrigger
                  value="blocker"
                  className="group flex items-center gap-3 rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-500 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-600 transition">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  Blockers
                </TabsTrigger>
                {!subStepId && (
                <TabsTrigger
                  value="status"
                  className="group flex items-center gap-3 rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-500 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-600 transition">
                    <Clock className="w-4 h-4" />
                  </span>
                  Status
                </TabsTrigger>
                )}
                {!subStepId && (
                <TabsTrigger
                  value="dependencies"
                  className="group flex items-center gap-3 rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-500 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-600 transition">
                    <GitBranch className="w-4 h-4" />
                  </span>
                  Dependencies
                </TabsTrigger>
                )}
                <TabsTrigger
                  value="history"
                  className="group flex items-center gap-3 rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-500 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-600 transition">
                    <History className="w-4 h-4" />
                  </span>
                  Timeline
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="scrollbar-hide seamless-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsContent value="blocker" className="space-y-4 pb-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Report Blocker
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="blockerType">Blocker Type</Label>
                      <Select value={blockerType} onValueChange={setBlockerType}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select blocker type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">Technical Issue</SelectItem>
                          <SelectItem value="resource">Resource Unavailable</SelectItem>
                          <SelectItem value="approval">Pending Approval</SelectItem>
                          <SelectItem value="dependency">Dependency Issue</SelectItem>
                          <SelectItem value="external">External Factor</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="blockerSeverity">Severity</Label>
                      <Select value={blockerSeverity} onValueChange={setBlockerSeverity}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="blockerDescription">Description</Label>
                    <Textarea
                      id="blockerDescription"
                      value={blockerDescription}
                      onChange={(e) => setBlockerDescription(e.target.value)}
                      placeholder="Describe the blocker in detail..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleBlockerSubmit} 
                    disabled={submitting}
                    className="mt-4 bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? 'Reporting...' : 'Report Blocker'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="brief" className="space-y-4 pb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Brief Update
                  </h3>
                  <div className="mb-4">
                    <Label htmlFor="briefType">Update Type</Label>
                    <Select value={briefType} onValueChange={setBriefType}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select update type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="progress_update">Progress Update</SelectItem>
                        <SelectItem value="requirement_change">Requirement Change</SelectItem>
                        <SelectItem value="scope_adjustment">Scope Adjustment</SelectItem>
                        <SelectItem value="timeline_update">Timeline Update</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="briefDescription">Update Details</Label>
                    <Textarea
                      id="briefDescription"
                      value={briefDescription}
                      onChange={(e) => setBriefDescription(e.target.value)}
                      placeholder="Provide detailed update information..."
                      rows={4}
                      className="text-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleBriefSubmit} 
                    disabled={submitting}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? 'Updating...' : 'Update Brief'}
                  </Button>
                </div>
              </TabsContent>

              {!subStepId && (
              <TabsContent value="status" className="space-y-4 pb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Update Status
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newStatus">New Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="newPriority">Priority</Label>
                      <Select value={newPriority} onValueChange={setNewPriority}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="statusDescription">Description</Label>
                    <Textarea
                      id="statusDescription"
                      value={statusDescription}
                      onChange={(e) => setStatusDescription(e.target.value)}
                      placeholder="Describe the status change..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      onClick={handleStatusSubmit} 
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {submitting ? 'Updating...' : 'Update Status'}
                    </Button>
                    <Button 
                      onClick={handlePrioritySubmit} 
                      disabled={submitting}
                      variant="outline"
                      className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      {submitting ? 'Updating...' : 'Update Priority'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              )}

              {!subStepId && (
              <TabsContent value="dependencies" className="space-y-4 pb-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    Step Dependencies
                  </h3>
                  <p className="text-sm text-purple-700 mb-4">
                    Manage dependencies between steps to ensure proper execution order and workflow.
                  </p>
                  <Button 
                    onClick={() => setShowDependencyModal(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <GitBranch className="w-4 h-4 mr-2" />
                    Manage Dependencies
                  </Button>
                </div>
              </TabsContent>
              )}

              <TabsContent value="history" className="space-y-4 pb-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Activity Timeline
                  </h3>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading history...</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No activity recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
                          <div className="flex-shrink-0 mt-1">
                            {getActionIcon(entry.action_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {entry.action_type.replace('_', ' ').toUpperCase()}
                              </span>
                              {entry.blocker_severity && getSeverityBadge(entry.blocker_severity)}
                              {entry.new_value && entry.action_type === 'status_change' && getStatusBadge(entry.new_value)}
                            </div>
                            {/* Show sub-step title if available */}
                            {entry.sub_step && (
                              <p className="text-sm font-semibold text-blue-600 mb-1">
                                "{entry.sub_step.title}"
                              </p>
                            )}
                            {entry.description && (
                              <p className="text-sm text-gray-600 mb-2">{entry.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(entry.created_at).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {entry.created_by_employee?.full_name || 'Unknown User'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, two-layer, size="sm" */}
        <div
          className={cn(
            'px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30 mt-auto',
            !isMobile && 'px-6 pt-4 pb-4'
          )}
        >
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="w-full md:w-auto">
              Close
            </Button>
          </div>
        </div>

        {/* Dependency Modal */}
        {showDependencyModal && (
          <StepDependencyModal
            isOpen={showDependencyModal}
            onClose={() => setShowDependencyModal(false)}
            taskStepId={taskStepId}
            stepTitle={stepTitle}
            taskId={taskId}
            onDependencyUpdate={() => {
              // Refresh data if needed
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
