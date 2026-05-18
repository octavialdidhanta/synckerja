import { Link } from 'react-router-dom';
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Edit, MessageCircle, MoreHorizontal, Eye, Trash2, Send } from "lucide-react";
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { NewLead } from '@/shared/types/leads';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

interface LeadActionsDropdownProps {
  lead: NewLead & { _fromWhatsApp?: boolean; _fromEmail?: boolean };
  onEdit: (lead: NewLead) => void;
  onViewDetail?: (lead: NewLead) => void;
  onDelete?: (leadId: string) => void;
  onTemplateFollowUp?: (lead: NewLead) => void;
}

/** Lead from channel: Open in Live Chat. Manual lead: dropdown with Edit, View Detail, Delete. */
export const LeadActionsDropdown = ({ lead, onEdit, onViewDetail, onDelete, onTemplateFollowUp }: LeadActionsDropdownProps) => {
  const { t } = useAppTranslation();
  const fromWhatsApp = (lead as any)._fromWhatsApp === true;
  const fromEmail = (lead as any)._fromEmail === true || (typeof lead.id === 'string' && lead.id.startsWith('email-'));
  const hasConversationId = fromWhatsApp || fromEmail;
  const ticketId = (lead.ticket_id ?? '').trim();
  const hasTicketId = /^(WA-|IG-|EMAIL-)/i.test(ticketId);
  const canOpenChat = hasConversationId || hasTicketId;
  const isManualLead = (lead.created_by ?? '').trim() !== '' && lead.created_by !== ZERO_UUID;

  if (canOpenChat) {
    const url = hasConversationId
      ? `/omnichannel/livechat?conversation=${String(lead.id).replace(/^wa-/, '').replace(/^email-/, '')}`
      : `/omnichannel/livechat?ticket_id=${encodeURIComponent(ticketId)}`;
    return (
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-medium" asChild>
        <Link to={url}>
          <MessageCircle className="h-4 w-4" />
          Open Chat
        </Link>
      </Button>
    );
  }

  if (isManualLead) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-medium">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onTemplateFollowUp && (
            <DropdownMenuItem onClick={() => onTemplateFollowUp(lead)}>
              <Send className="h-4 w-4 mr-2" />
              {t('leadsManagement.actions.followup', 'Followup')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(lead)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          {onViewDetail && (
            <DropdownMenuItem onClick={() => onViewDetail(lead)}>
              <Eye className="h-4 w-4 mr-2" />
              View Detail
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => {
                if (window.confirm('Yakin ingin menghapus lead ini?')) {
                  onDelete(lead.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
};
