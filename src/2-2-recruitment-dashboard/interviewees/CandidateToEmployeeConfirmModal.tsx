
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { User, Star, UserPlus, X } from 'lucide-react';

interface CandidateToEmployeeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateScore: number;
  scoreCount: number;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export const CandidateToEmployeeConfirmModal = ({
  open,
  onOpenChange,
  candidateName,
  candidateScore,
  scoreCount,
  onConfirm,
  isProcessing = false
}: CandidateToEmployeeConfirmModalProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600 bg-green-100';
    if (score >= 3.5) return 'text-blue-600 bg-blue-100';
    if (score >= 2.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <UserPlus className="h-8 w-8 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Convert to Employee
          </DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to convert this candidate to an employee?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Candidate Info Card */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{candidateName}</p>
                {scoreCount > 0 ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className={`text-sm font-medium ${getScoreColor(candidateScore).split(' ')[0]}`}>
                        {candidateScore}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {scoreCount} review{scoreCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No reviews yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isProcessing}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isProcessing ? 'Converting...' : 'Convert'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
