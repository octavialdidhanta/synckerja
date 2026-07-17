import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { OmnichannelContactRow } from '@/5-3-whatsapp/hooks/useOmnichannelContacts';

function maskPhoneLast4(phone: string): string {
  const s = phone.trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

function formatCaptureDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Props = {
  rows: OmnichannelContactRow[];
  isLoading: boolean;
};

export function OmnichannelContactTable({ rows, isLoading }: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">{t('omnichannel.contact.loading')}</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-foreground">{t('omnichannel.contact.emptyTitle')}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('omnichannel.contact.emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('omnichannel.contact.colName')}</TableHead>
            <TableHead>{t('omnichannel.contact.colPhone')}</TableHead>
            <TableHead>{t('omnichannel.contact.colCampaign')}</TableHead>
            <TableHead>{t('omnichannel.contact.colTargetMarket')}</TableHead>
            <TableHead>{t('omnichannel.contact.colCapturedAt')}</TableHead>
            <TableHead>{t('omnichannel.contact.colSource')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name || '—'}</TableCell>
              <TableCell className="font-mono text-sm">{maskPhoneLast4(row.phone_number)}</TableCell>
              <TableCell>{row.campaign_name || '—'}</TableCell>
              <TableCell>{row.target_market}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatCaptureDate(row.captured_at)}</TableCell>
              <TableCell>{row.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
