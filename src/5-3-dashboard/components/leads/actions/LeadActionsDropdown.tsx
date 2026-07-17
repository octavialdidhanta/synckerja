import { Link } from 'react-router-dom';
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Edit, MessageCircle, MoreHorizontal, Eye, Trash2, Send } from "lucide-react";
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { NewLead } from '@/shared/types/leads';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

interface LeadActionsDropdownProps {
  lead: NewLead & {
    _fromWhatsApp?: boolean;
    _fromInstagram?: boolean;
    _fromEmail?: boolean;
    _fromFacebook?: boolean;
    _fromLeadMagnet?: boolean;
    _leadMagnetConversationId?: string | null;
    whatsapp_conversation_id?: string | null;
  };
  onEdit: (lead: NewLead) => void;
  onViewDetail?: (lead: NewLead) => void;
  onDelete?: (leadId: string) => void;
  onTemplateFollowUp?: (lead: NewLead) => void;
}

function isLeadMagnetWithLinkedConversation(lead: LeadActionsDropdownProps['lead']): boolean {
  return (
    lead._fromLeadMagnet === true &&
    Boolean(String(lead._leadMagnetConversationId ?? '').trim())
  );
}

export function buildLivechatUrl(lead: LeadActionsDropdownProps['lead']): string | null {
  const leadMagnetConvId = String((lead as { _leadMagnetConversationId?: string | null })._leadMagnetConversationId ?? '').trim();
  if (leadMagnetConvId) {
    return `/omnichannel/livechat?conversation=${encodeURIComponent(leadMagnetConvId)}`;
  }

  const idStr = String(lead.id ?? '');
  const fromWhatsApp = lead._fromWhatsApp === true || idStr.startsWith('wa-');
  const fromFacebook = lead._fromFacebook === true || idStr.startsWith('fb-');
  const fromInstagram = lead._fromInstagram === true || idStr.startsWith('ig-');
  const fromEmail = lead._fromEmail === true || idStr.startsWith('email-');
  const hasVirtualConversationId = fromWhatsApp || fromFacebook || fromInstagram || fromEmail;

  if (hasVirtualConversationId) {
    const convId = idStr
      .replace(/^wa-/, '')
      .replace(/^fb-/, '')
      .replace(/^ig-/, '')
      .replace(/^email-/, '');
    return `/omnichannel/livechat?conversation=${encodeURIComponent(convId)}`;
  }

  const waConversationId = (lead.whatsapp_conversation_id ?? '').trim();
  if (waConversationId) {
    return `/omnichannel/livechat?conversation=${encodeURIComponent(waConversationId)}`;
  }

  const ticketId = (lead.ticket_id ?? '').trim();
  if (/^(WA-|IG-|FB-|EMAIL-)/i.test(ticketId)) {
    return `/omnichannel/livechat?ticket_id=${encodeURIComponent(ticketId)}`;
  }

  return null;
}

/** Lead from channel: Open in Live Chat. Manual lead: dropdown with Edit, View Detail, Delete. */
export const LeadActionsDropdown = ({ lead, onEdit, onViewDetail, onDelete, onTemplateFollowUp }: LeadActionsDropdownProps) => {
  const { t } = useAppTranslation();
  const openChatUrl = buildLivechatUrl(lead);
  const isManualLead =
    !isLeadMagnetWithLinkedConversation(lead) &&
    (lead.created_by ?? '').trim() !== '' &&
    lead.created_by !== ZERO_UUID;

  if (openChatUrl) {
    return (
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-medium" asChild>
        <Link to={openChatUrl}>
          <MessageCircle className="h-4 w-4" />
          {t('leadsManagement.dialog.openChat', 'Open Chat')}
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
