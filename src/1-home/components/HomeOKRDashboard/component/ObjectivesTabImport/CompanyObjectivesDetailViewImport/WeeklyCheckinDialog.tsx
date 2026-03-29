
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCreateWeeklyCheckin, getCurrentWeekDates } from '@/hooks/useWeeklyCheckins';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { Calendar, TrendingUp } from 'lucide-react';
import type { CheckinStatus } from '@/types/okr';

interface WeeklyCheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: {
    id: string;
    title: string;
    current_value: number;
    target_value: number;
    start_value: number;
    unit?: string;
    objective: {
      title: string;
    };
  };
  organizationId: string;
}

interface CheckinFormData {
  current_value: number;
  confidence_level: number;
  status: CheckinStatus;
  comments: string;
  blockers: string;
}

export const WeeklyCheckinDialog: React.FC<WeeklyCheckinDialogProps> = ({
  open,
  onOpenChange,
  keyResult,
  organizationId
}) => {
  const [formData, setFormData] = useState<CheckinFormData>({
    current_value: keyResult.current_value,
    confidence_level: 8,
    status: 'on_track',
    comments: '',
    blockers: ''
  });

  const { user } = useCurrentUser();
  const createCheckin = useCreateWeeklyCheckin();
  const { toast } = useToast();

  const weekDates = getCurrentWeekDates();
  
  // Calculate progress percentage
  const calculateProgress = (current: number) => {
    const total = keyResult.target_value - keyResult.start_value;
    const achieved = current - keyResult.start_value;
    return Math.max(0, Math.min(100, (achieved / total) * 100));
  };

  const currentProgress = calculateProgress(formData.current_value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'Authentication required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCheckin.mutateAsync({
        organization_id: organizationId,
        key_result_id: keyResult.id,
        employee_id: user.id,
        week_start_date: weekDates.start,
        current_value: formData.current_value,
        confidence_level: formData.confidence_level,
        status: formData.status,
        comments: formData.comments || undefined,
        blockers: formData.blockers || undefined
      });

      toast({
        title: 'Success',
        description: 'Weekly check-in submitted successfully',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating weekly check-in:', error);
    }
  };

  const getStatusColor = (status: CheckinStatus) => {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      case 'off_track': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Check-in
          </DialogTitle>
          <DialogDescription className="space-y-1 text-sm text-gray-600">
            <p>Week of {new Date(weekDates.start).toLocaleDateString()}</p>
            <p className="font-medium">{keyResult.objective.title}</p>
            <p>{keyResult.title}</p>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Progress Overview */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Progress</span>
              <Badge variant="outline">
                {currentProgress.toFixed(1)}%
              </Badge>
            </div>
            <Progress value={currentProgress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Start: {keyResult.start_value}{keyResult.unit}</span>
              <span>Current: {formData.current_value}{keyResult.unit}</span>
              <span>Target: {keyResult.target_value}{keyResult.unit}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_value">Current Value</Label>
              <div className="flex gap-2">
                <Input
                  id="current_value"
                  type="number"
                  value={formData.current_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_value: Number(e.target.value) }))}
                  required
                />
                {keyResult.unit && (
                  <div className="flex items-center px-3 bg-gray-100 rounded-md text-sm text-gray-500">
                    {keyResult.unit}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence_level">Confidence Level (1-10)</Label>
              <Select
                value={formData.confidence_level.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, confidence_level: Number(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      {level} - {level <= 3 ? 'Low' : level <= 7 ? 'Medium' : 'High'} Confidence
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as CheckinStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      On Track
                    </div>
                  </SelectItem>
                  <SelectItem value="at_risk">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      At Risk
                    </div>
                  </SelectItem>
                  <SelectItem value="off_track">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      Off Track
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="comments">Progress Comments</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Share progress updates, wins, or observations..."
                rows={3}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="blockers">Blockers or Challenges</Label>
              <Textarea
                id="blockers"
                value={formData.blockers}
                onChange={(e) => setFormData(prev => ({ ...prev, blockers: e.target.value }))}
                placeholder="Describe any obstacles or support needed..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createCheckin.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createCheckin.isPending}
            >
              {createCheckin.isPending ? 'Submitting...' : 'Submit Check-in'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
