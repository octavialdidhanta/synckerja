import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { 
  GitBranch, 
  ArrowRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Plus,
  Trash2,
  Edit,
  Calendar,
  User
} from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';

interface StepDependency {
  id: string;
  task_step_id: string;
  depends_on_step_id: string;
  dependency_type: string;
  lag_days: number;
  description: string | null;
  created_at: string;
  created_by: string;
  depends_on_step: {
    id: string;
    title: string;
    status: string;
    is_completed: boolean;
  };
}

interface AvailableStep {
  id: string;
  title: string;
  status: string;
  is_completed: boolean;
  order: number;
}

interface StepDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskStepId: string;
  stepTitle: string;
  taskId: string;
  onDependencyUpdate?: () => void;
}

export const StepDependencyModal: React.FC<StepDependencyModalProps> = ({
  isOpen,
  onClose,
  taskStepId,
  stepTitle,
  taskId,
  onDependencyUpdate
}) => {
  const [dependencies, setDependencies] = useState<StepDependency[]>([]);
  const [availableSteps, setAvailableSteps] = useState<AvailableStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Add dependency form state
  const [selectedStepId, setSelectedStepId] = useState('');
  const [dependencyType, setDependencyType] = useState('finish_to_start');
  const [lagDays, setLagDays] = useState(0);
  const [dependencyDescription, setDependencyDescription] = useState('');
  
  const { toast } = useToast();

  const fetchDependencies = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('task_step_dependencies')
        .select(`
          *,
          depends_on_step:task_steps!depends_on_step_id(id, title, status, is_completed)
        `)
        .eq('task_step_id', taskStepId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDependencies(data || []);
    } catch (error: any) {
      console.error('Error fetching dependencies:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch dependencies: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSteps = async () => {
    if (!isOpen) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('task_steps')
        .select('id, title, status, is_completed, order')
        .eq('task_id', taskId)
        .neq('id', taskStepId) // Exclude current step
        .order('order', { ascending: true });

      if (error) throw error;
      setAvailableSteps(data || []);
    } catch (error: any) {
      console.error('Error fetching available steps:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDependencies();
      fetchAvailableSteps();
    }
  }, [isOpen, taskStepId, taskId]);

  const addDependency = async () => {
    if (!selectedStepId || !dependencyType) {
      toast({
        title: 'Error',
        description: 'Please select a step and dependency type',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await (supabase as any)
        .from('task_step_dependencies')
        .insert({
          task_step_id: taskStepId,
          depends_on_step_id: selectedStepId,
          dependency_type: dependencyType,
          lag_days: lagDays,
          description: dependencyDescription.trim() || null,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Dependency added successfully!',
      });

      // Reset form
      setSelectedStepId('');
      setDependencyType('finish_to_start');
      setLagDays(0);
      setDependencyDescription('');

      fetchDependencies();
      onDependencyUpdate?.();
    } catch (error: any) {
      console.error('Error adding dependency:', error);
      toast({
        title: 'Error',
        description: `Failed to add dependency: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const removeDependency = async (dependencyId: string) => {
    if (!window.confirm('Are you sure you want to remove this dependency?')) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('task_step_dependencies')
        .delete()
        .eq('id', dependencyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Dependency removed successfully!',
      });

      fetchDependencies();
      onDependencyUpdate?.();
    } catch (error: any) {
      console.error('Error removing dependency:', error);
      toast({
        title: 'Error',
        description: `Failed to remove dependency: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const getDependencyTypeIcon = (type: string) => {
    switch (type) {
      case 'finish_to_start': return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'start_to_start': return <Clock className="w-4 h-4 text-green-500" />;
      case 'finish_to_finish': return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'start_to_finish': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <GitBranch className="w-4 h-4 text-gray-500" />;
    }
  };

  const getDependencyTypeLabel = (type: string) => {
    switch (type) {
      case 'finish_to_start': return 'Finish to Start';
      case 'start_to_start': return 'Start to Start';
      case 'finish_to_finish': return 'Finish to Finish';
      case 'start_to_finish': return 'Start to Finish';
      default: return type;
    }
  };

  const getStepStatusBadge = (status: string, isCompleted: boolean) => {
    if (isCompleted) {
      return <Badge className="bg-green-100 text-green-700 border-green-200 px-2 py-1 text-xs">COMPLETED</Badge>;
    }
    
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
      <DialogContent className="w-[720px] h-[720px] max-w-[95vw] max-h-[95vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold truncate">
                Step Dependencies
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1 truncate">
                Manage dependencies for "{stepTitle}"
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="space-y-6 h-full overflow-y-auto pr-1">
            {/* Add Dependency Form */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Dependency
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="selectedStep">Depends On Step</Label>
                  <Select value={selectedStepId} onValueChange={setSelectedStepId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a step" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSteps.map((step) => (
                        <SelectItem key={step.id} value={step.id}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{step.title}</span>
                            {getStepStatusBadge(step.status, step.is_completed)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dependencyType">Dependency Type</Label>
                  <Select value={dependencyType} onValueChange={setDependencyType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dependency type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finish_to_start">Finish to Start</SelectItem>
                      <SelectItem value="start_to_start">Start to Start</SelectItem>
                      <SelectItem value="finish_to_finish">Finish to Finish</SelectItem>
                      <SelectItem value="start_to_finish">Start to Finish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="lagDays">Lag Days</Label>
                  <Input
                    id="lagDays"
                    type="number"
                    value={lagDays}
                    onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="dependencyDescription">Description (Optional)</Label>
                  <Input
                    id="dependencyDescription"
                    value={dependencyDescription}
                    onChange={(e) => setDependencyDescription(e.target.value)}
                    placeholder="Describe the dependency..."
                  />
                </div>
              </div>
              <Button 
                onClick={addDependency} 
                disabled={submitting || !selectedStepId}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Adding...' : 'Add Dependency'}
              </Button>
            </div>

            {/* Dependencies List */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Current Dependencies ({dependencies.length})
              </h3>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading dependencies...</p>
                </div>
              ) : dependencies.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No dependencies defined</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dependencies.map((dependency) => (
                    <div key={dependency.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {getDependencyTypeIcon(dependency.dependency_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {dependency.depends_on_step?.title || 'Unknown Step'}
                            </span>
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-2 py-1 text-xs">
                              {getDependencyTypeLabel(dependency.dependency_type)}
                            </Badge>
                            {dependency.lag_days > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 px-2 py-1 text-xs">
                                +{dependency.lag_days} days
                              </Badge>
                            )}
                          </div>
                          {dependency.description && (
                            <p className="text-sm text-gray-600 mb-1">{dependency.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(dependency.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {dependency.created_by}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDependency(dependency.id)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                        title="Remove dependency"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} className="w-full md:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
