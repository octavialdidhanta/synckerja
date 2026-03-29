
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Download, Mail, MessageSquare } from 'lucide-react';

interface CandidateActionsDropdownProps {
  onQuickView: () => void;
  onDownloadCV: () => void;
  onSendEmail: () => void;
  onSendWhatsApp: () => void;
  hasCV: boolean;
}

export const CandidateActionsDropdown = ({
  onQuickView,
  onDownloadCV,
  onSendEmail,
  onSendWhatsApp,
  hasCV
}: CandidateActionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onQuickView}>
          <Eye className="mr-2 h-4 w-4" />
          Quick View
        </DropdownMenuItem>
        
        {hasCV && (
          <DropdownMenuItem onClick={onDownloadCV}>
            <Download className="mr-2 h-4 w-4" />
            Download CV
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={onSendEmail}>
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onSendWhatsApp}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Send WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
