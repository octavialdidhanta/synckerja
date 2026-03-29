
import { CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

interface ApplicationSuccessProps {
  profileLink: string;
  applicantName: string;
  onClose: () => void;
}

export function ApplicationSuccess({ profileLink, applicantName, onClose }: ApplicationSuccessProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
              Application Submitted Successfully!
            </DialogTitle>
            <p className="text-gray-600">
              Thank you, {applicantName}! Your job application has been received.
            </p>
          </div>

          <div className="text-center">
            <Button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
