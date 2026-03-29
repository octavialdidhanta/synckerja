
import { useState, useEffect } from 'react';
import { Edit, User, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
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
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

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
  onEditSuccess: (id: string, data: any) => Promise<void>;
}

const EditMeetingPointDialog = ({ isOpen, onClose, meetingPoint, onEditSuccess }: EditMeetingPointDialogProps) => {
  const [formData, setFormData] = useState({
    discussion_point: '',
    request_by: '',
    status: 'Not Started'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: employees = [], isLoading: isLoadingEmployees } = useAvailableEmployees();

  useEffect(() => {
    if (meetingPoint) {
      setFormData({
        discussion_point: meetingPoint.discussion_point,
        request_by: meetingPoint.request_by || '',
        status: meetingPoint.status
      });
    }
  }, [meetingPoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.discussion_point.trim()) return;

    setIsSubmitting(true);
    try {
      const requestByName = employees.find((e) => e.id === formData.request_by)?.full_name ?? formData.request_by;
      await onEditSuccess(meetingPoint.id, { ...formData, request_by: requestByName });
      onClose();
    } catch {
      // Error surfaced to caller
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            Edit Meeting Point
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="mt-1 min-h-[100px] resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-request-by" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <User className="w-3 h-3" />
                Request By
              </Label>
              <Select
                value={employees.find((e) => e.id === formData.request_by || e.full_name === formData.request_by || e.email === formData.request_by)?.id ?? (formData.request_by || '')}
                onValueChange={(value) => handleInputChange('request_by', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={isLoadingEmployees ? "Loading employees..." : "Select employee..."} />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md z-50">
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
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md z-50">
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="On Going">On Going</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Presented">Presented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!formData.discussion_point.trim() || isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Meeting Point'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMeetingPointDialog;
