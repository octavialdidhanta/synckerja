import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Copy, Check, Info, ExternalLink } from 'lucide-react';
import { JobOpening } from '../hooks/jobOpeningTypes';
import { 
  createRecruitmentLink, 
  getRecruitmentLinkByJobId, 
  generateRecruitmentToken 
} from '../hooks/optimizedRecruitmentLinkUtils';
import { RecruitmentLink } from '../hooks/recruitmentLinkTypes';
import { useToast } from '@/shared/components/ui/use-toast';

interface GenerateLinkModalProps {
  open: boolean;
  onClose: () => void;
  job: JobOpening | null;
}

export function GenerateLinkModal({ open, onClose, job }: GenerateLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const [existingLink, setExistingLink] = useState<RecruitmentLink | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  
  // Fix base URL generation to prevent SecurityError and double slash
  const baseUrl = window.location.origin;
  const jobLink = existingLink ? `${baseUrl}/apply/preview/${existingLink.token}` : '';

  // Add logging for debugging
  console.log('Base URL:', baseUrl);
  console.log('Generated job link:', jobLink);

  const loadExistingLink = useCallback(async () => {
    if (!job) return;
    try {
      const link = await getRecruitmentLinkByJobId(job.id);
      setExistingLink(link);
    } catch (error) {
      console.error('Error loading existing link:', error);
    }
  }, [job?.id]);

  useEffect(() => {
    if (open && job) {
      loadExistingLink();
      // Reset states when modal opens
      setCopied(false);
      setShowSuccess(false);
    } else {
      // Reset states when modal closes
      setExistingLink(null);
      setCopied(false);
      setShowSuccess(false);
    }
  }, [open, job?.id, loadExistingLink]);

  const generateNewLink = async () => {
    if (!job) return;
    
    setGenerating(true);
    try {
      const token = generateRecruitmentToken();
      const newLink = await createRecruitmentLink({
        job_opening_id: job.id,
        token
      });
      setExistingLink(newLink);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      toast({ title: "New recruitment link generated successfully!" });
    } catch (error) {
      console.error('Error generating link:', error);
      toast({ 
        title: "Error", 
        description: "Failed to generate recruitment link", 
        variant: "destructive" 
      });
    }
    setGenerating(false);
  };
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jobLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard!" });
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const openInNewTab = () => {
    window.open(jobLink, '_blank');
  };

  return (
    <Dialog open={open && !!job} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Recruitment Link</DialogTitle>
          <DialogDescription>
            Generate a unique link for this job opening to share with candidates
          </DialogDescription>
        </DialogHeader>
        {job && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="job-position" className="text-sm font-medium">
                Job Position
              </Label>
              <Input
                id="job-position"
                value={job.job_title}
                readOnly
                className="mt-1 bg-gray-50"
              />
            </div>

          {existingLink && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Information</p>
                  <p>There is already an existing recruitment link for this job position. You can copy the existing link or generate a new one.</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Existing Recruitment Link
                </Label>
                <div className="flex mt-1 space-x-2">
                  <Input
                    value={jobLink}
                    readOnly
                    className="flex-1 bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="px-3"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openInNewTab}
                    className="px-3"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-green-800 text-sm font-medium">
                ✓ New recruitment link has been generated successfully!
              </p>
            </div>
          )}
          
          <div className="flex justify-between space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button 
              onClick={generateNewLink} 
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? 'Generating...' : 'Generate New Link'}
            </Button>
          </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
