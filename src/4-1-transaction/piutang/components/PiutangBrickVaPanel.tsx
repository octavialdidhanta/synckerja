import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { createBrickCloseVa, getBrickVaStatus } from '@/4-1-transaction/lib/brickBankApi';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { shouldOfferPiutangVaCollection } from '../utils/piutangVaCollection';
import { useBrickPaymentRequest } from '../hooks/useBrickPaymentRequest';

const BRICK_VA_BANKS = [
  { code: 'MANDIRI', label: 'Bank Mandiri' },
  { code: 'BRI', label: 'Bank BRI' },
  { code: 'BCA', label: 'Bank BCA (sandbox QA may be unreliable)' },
];

type Props = {
  organizationId: string | null | undefined;
  paymentId: string;
  paymentAmount: number;
  clientName?: string;
  verificationStatus?: string | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
  onCreated?: () => void;
};

function bankNameMatchesCode(bankName: string | null | undefined, code: string): boolean {
  if (!bankName) return false;
  const n = bankName.toLowerCase();
  if (code === 'MANDIRI') return n.includes('mandiri');
  if (code === 'BRI') return n.includes('bri');
  if (code === 'BCA') return n.includes('bca');
  return n.includes(code.toLowerCase());
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'paid') return 'secondary';
  if (status === 'expired' || status === 'failed') return 'destructive';
  return 'outline';
}

export function PiutangBrickVaPanel({
  organizationId,
  paymentId,
  paymentAmount,
  clientName,
  verificationStatus,
  paymentMethod,
  receiptUrl,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const { bankAccounts } = useBankAccounts();
  const { data: brickRequest, refetch } = useBrickPaymentRequest(organizationId, paymentId);
  const [bankCode, setBankCode] = useState('MANDIRI');
  const [loading, setLoading] = useState(false);
  const [copiedVa, setCopiedVa] = useState(false);

  const linkedBanks = useMemo(() => {
    const linked = bankAccounts.filter((a) => a.brick_link_status === 'linked' && a.is_active);
    return BRICK_VA_BANKS.filter((b) =>
      linked.some((a) => bankNameMatchesCode(a.bank_name, b.code)),
    );
  }, [bankAccounts]);

  if (verificationStatus === 'approved') {
    return null;
  }

  if (
    !shouldOfferPiutangVaCollection({
      transferVerificationStatus: verificationStatus,
      paymentMethod,
      receiptUrl,
    })
  ) {
    return null;
  }

  if (!linkedBanks.length) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {t(
          'incomes.brick.va.linkAccountHint',
          'Hubungkan rekening bank ke Brick untuk membuat Virtual Account.',
        )}{' '}
        <Link to="/incomes/bank-accounts" className="text-blue-600 underline">
          {t('incomes.brick.va.bankAccountsLink', 'Kelola rekening')}
        </Link>
      </p>
    );
  }

  const handleCreate = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await createBrickCloseVa(organizationId, paymentId, bankCode, clientName);
      toast.success(t('incomes.brick.va.created', 'VA Brick siap — bagikan ke klien'));
      await refetch();
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!organizationId || !brickRequest?.id) return;
    setLoading(true);
    try {
      await getBrickVaStatus(organizationId, {
        brickPaymentRequestId: brickRequest.id,
        processUpdate: true,
      });
      await refetch();
      toast.success(t('incomes.brick.va.statusUpdated', 'Status VA diperbarui'));
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyVaNumber = async () => {
    const accountNo = brickRequest?.account_no?.trim();
    if (!accountNo) return;
    try {
      await navigator.clipboard.writeText(accountNo);
      setCopiedVa(true);
      toast.success(t('incomes.brick.va.copied', 'Nomor VA disalin'));
      window.setTimeout(() => setCopiedVa(false), 2000);
    } catch {
      toast.error(t('incomes.brick.va.copyFailed', 'Gagal menyalin nomor VA'));
    }
  };

  const activeRequest =
    brickRequest &&
    (brickRequest.status === 'pending' ||
      brickRequest.status === 'paid' ||
      brickRequest.status === 'completed');

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-emerald-200 bg-emerald-50/50 p-3">
      <div>
        <p className="text-sm font-medium text-emerald-900">
          {t('incomes.brick.va.title', 'Terima pembayaran via Brick VA')}
        </p>
        <p className="mt-0.5 text-xs text-emerald-800/80">
          {t(
            'incomes.brick.va.hint',
            'Buat VA Brick dan bagikan nomor virtual account ke klien.',
          )}
        </p>
      </div>

      {activeRequest ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(brickRequest.status)}>
              {t(`incomes.brick.va.status.${brickRequest.status}`, brickRequest.status)}
            </Badge>
            {brickRequest.status === 'completed' && (
              <span className="text-xs text-emerald-700">
                {t('incomes.brick.va.completedHint', 'Pembayaran diterima — piutang disetujui otomatis')}
              </span>
            )}
          </div>
          <p>
            <span className="text-muted-foreground">{t('incomes.brick.va.bank', 'Bank')}: </span>
            {brickRequest.bank_short_code}
          </p>
          {brickRequest.account_no && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono font-semibold">{brickRequest.account_no}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void handleCopyVaNumber()}
                aria-label={t('incomes.brick.va.copyVaNumber', 'Salin nomor VA')}
              >
                {copiedVa ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('incomes.brick.va.copyVaNumber', 'Salin nomor VA')}
              </Button>
            </div>
          )}
          <p>
            <span className="text-muted-foreground">{t('incomes.brick.va.amount', 'Jumlah')}: </span>
            {formatToRupiah(Number(brickRequest.expected_amount ?? paymentAmount))}
          </p>
          {brickRequest.expires_at && (
            <p className="text-xs text-muted-foreground">
              {t('incomes.brick.va.expires', 'Kadaluarsa')}:{' '}
              {new Date(brickRequest.expires_at).toLocaleString()}
            </p>
          )}
          {(brickRequest.status === 'pending' || brickRequest.status === 'paid') && (
            <Button size="sm" variant="outline" onClick={handleRefreshStatus} disabled={loading}>
              {loading
                ? t('incomes.brick.va.checking', 'Memeriksa…')
                : t('incomes.brick.va.refreshStatus', 'Cek status pembayaran')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div>
            <Label>{t('incomes.brick.va.selectBank', 'Bank VA')}</Label>
            <Select
              value={bankCode}
              onValueChange={setBankCode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {linkedBanks.map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={loading}>
            {loading
              ? t('incomes.brick.va.creating', 'Membuat…')
              : t('incomes.brick.va.generate', 'Buat Brick VA')}
          </Button>
        </>
      )}
    </div>
  );
}
