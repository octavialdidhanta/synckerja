
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { formatPhoneToWhatsApp, createWhatsAppMessage } from '@/utils/phoneUtils';

interface InterviewWhatsAppButtonProps {
  candidateName: string;
  candidatePhone: string;
  position: string;
  organizationName: string;
  profileLink: string;
  interviewDetails: {
    date?: string;
    time?: string;
    location?: string;
    interviewer?: string;
  };
  className?: string;
}

export const InterviewWhatsAppButton = ({
  candidateName,
  candidatePhone,
  position,
  organizationName,
  profileLink,
  interviewDetails,
  className = ""
}: InterviewWhatsAppButtonProps) => {
  const [isSending, setIsSending] = useState(false);

  const handleWhatsAppClick = () => {
    if (!candidatePhone) {
      alert('No phone number available for this candidate');
      return;
    }

    setIsSending(true);
    try {
      const formattedPhone = formatPhoneToWhatsApp(candidatePhone);
      const message = createWhatsAppMessage(candidateName, position, organizationName, profileLink, interviewDetails);
      const whatsappUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in a new tab
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error creating WhatsApp message:', error);
      alert('Error creating WhatsApp message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      onClick={handleWhatsAppClick}
      disabled={isSending}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 ${className}`}
    >
      <MessageCircle className="h-4 w-4 text-green-600" />
      <span>{isSending ? 'Sending...' : 'Send WhatsApp'}</span>
    </Button>
  );
};
