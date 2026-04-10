import { useState, useEffect } from 'react';
import { Edit, User, FileText } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Textarea } from '@/features/ui/textarea';
import { Label } from '@/features/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { useToast } from '@/features/1-login/hooks/use-toast';
import { logger } from '@/config/logger';
import { cn } from '@/lib/utils';

interface MeetingPoint {
  id: string;
  meeting_date: string;
  discussion_point: string;
  request_by: string | null;
  status: string;
  updates: string | null;
  created_at: string;
}

interface EditMeetingPointDialogProps {
  isOpen: boolean;
  onClose: () => void;
  meetingPoint: MeetingPoint;
  onEditSuccess: (id: string, data: Partial<MeetingPoint>) => Promise<void>;
}

const EditMeetingPointDialog = ({ isOpen, onClose, meetingPoint, onEditSuccess }: EditMeetingPointDialogProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    discussion_point: '',
    request_by: '',
    status: 'Not Started'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: employees = [], isLoading: isLoadingEmployees } = useAvailableEmployees();

  useEffect(() => {
    if (meetingPoint && employees.length > 0) {
      const requestByName = meetingPoint.request_by || '';
      const requestById =
        requestByName &&
        employees.find((e) => (e.full_name || e.email) === requestByName)?.id;
      setFormData((prev) => ({
        ...prev,
        discussion_point: meetingPoint.discussion_point,
        request_by: requestById ?? requestByName,
        status: meetingPoint.status,
      }));
    } else if (meetingPoint) {
      setFormData({
        discussion_point: meetingPoint.discussion_point,
        request_by: meetingPoint.request_by || '',
        status: meetingPoint.status,
      });
    }
  }, [meetingPoint, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.discussion_point.trim()) return;

    setIsSubmitting(true);
    try {
      const requestByName =
        formData.request_by &&
        (employees.find((e) => e.id === formData.request_by)?.full_name ||
          employees.find((e) => e.id === formData.request_by)?.email) ||
        formData.request_by;
      await onEditSuccess(meetingPoint.id, {
        ...formData,
        request_by: requestByName,
      });
      onClose();
    } catch (error) {
      logger.error('Error updating meeting point:', error);
      toast({ title: 'Error', description: 'Failed to update meeting point', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
            : 'md:max-w-2xl md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader className={cn(
          'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
          isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
        )}>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="lowercase truncate">Edit Meeting Point</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
          <form id="edit-meeting-point-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-discussion-point" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Discussion Point
              </Label>
              <Textarea
                id="edit-discussion-point"
                placeholder="Enter discussion point..."
                value={formData.discussion_point}
                onChange={(e) => handleInputChange('discussion_point', e.target.value)}
                className="text-sm mt-1 min-h-[100px] resize-none break-words max-w-full"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-request-by" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Request By
                </Label>
                <Select value={formData.request_by} onValueChange={(value) => handleInputChange('request_by', value)}>
                  <SelectTrigger className="text-sm mt-1">
                    <SelectValue placeholder={isLoadingEmployees ? "Loading employees..." : "Select employee..."} />
                  </SelectTrigger>
                <SelectContent className="bg-white border shadow-md z-50 w-full max-w-[calc(100vw-2rem)] md:min-w-[300px] md:max-w-none">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger className="text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent className="bg-white border shadow-md z-50 w-full max-w-[calc(100vw-2rem)] md:min-w-[200px] md:max-w-none">
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="On Going">On Going</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Presented">Presented</SelectItem>
                </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - pt-3 pb-3 so spacing above and below buttons is equal; modal-above-safe-area already keeps modal above nav bar */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-meeting-point-form"
              size="sm"
              disabled={!formData.discussion_point.trim() || isSubmitting}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                'Update Meeting Point'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditMeetingPointDialog;

