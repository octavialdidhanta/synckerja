import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useBankAccounts, BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useBankMutations } from '@/shared/hooks/finance/useBankMutations';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Plus, Edit, Trash2, Loader2, Link2, Unlink } from 'lucide-react';
import { useBrickOAuthReturn } from '@/4-1-transaction/hooks/useBrickOAuthReturn';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { BrickLinkStatusBadge } from '@/shared/components/finance/BrickLinkTableCell';
import { validateGatewayPayoutBank } from '@/xendit/lib/xenditApi';
import { mapBankNameToXenditCode } from '@/xendit/lib/bankCodes';
import { cn } from '@/shared/lib/utils';

export const BankAccountManagement: React.FC = () => {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { canAllocateIncome } = useCanAllocateIncome();
  const { bankAccounts, loading, createBankAccount, updateBankAccount, deleteBankAccount, refetch } =
    useBankAccounts({ includeInactive: true });
  const { balances } = useBankAccountBalances();
  const { linkBrick, unlinkBrick, linkingBrick, unlinkingBrick } = useBankMutations({
    bankAccountId: 'all',
    direction: 'all',
    matchFilter: 'all',
  });

  const [togglingOmnichannelId, setTogglingOmnichannelId] = useState<string | null>(null);
  const [togglingGatewayPayoutId, setTogglingGatewayPayoutId] = useState<string | null>(null);
  const [brickActionId, setBrickActionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    bank_name: '',
    account_holder: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useBrickOAuthReturn('bank', refetch);

  const erpBalanceByAccount = new Map(balances.map((b) => [b.bank_account_id, b.balance]));

  const handleAdd = () => {
    setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
    setEditingBankAccount(null);
    setIsEditing(true);
  };

  const handleEdit = (bankAccount: BankAccount) => {
    setFormData({
      name: bankAccount.name,
      account_number: bankAccount.account_number || '',
      bank_name: bankAccount.bank_name || '',
      account_holder: bankAccount.account_holder || '',
    });
    setEditingBankAccount(bankAccount);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      if (editingBankAccount) {
        await updateBankAccount(editingBankAccount.id, formData);
      } else {
        await createBankAccount(formData);
      }
      setIsEditing(false);
      setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
      setEditingBankAccount(null);
    } catch {
      // Error handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      await deleteBankAccount(id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
    setEditingBankAccount(null);
  };

  const handleOmnichannelToggle = async (bankAccount: BankAccount, checked: boolean) => {
    setTogglingOmnichannelId(bankAccount.id);
    try {
      await updateBankAccount(bankAccount.id, { use_for_omnichannel_income: checked });
    } catch {
      // Toast handled in hook
    } finally {
      setTogglingOmnichannelId(null);
    }
  };

  const handleGatewayPayoutToggle = async (bankAccount: BankAccount, checked: boolean) => {
    if (!organizationId) return;
    setTogglingGatewayPayoutId(bankAccount.id);
    try {
      if (!checked) {
        await updateBankAccount(bankAccount.id, { use_for_gateway_payout: false });
        return;
      }
      const bankCode =
        bankAccount.gateway_payout_bank_code?.trim() ||
        mapBankNameToXenditCode(bankAccount.bank_name ?? '');
      if (!bankAccount.account_number?.trim() || !bankAccount.account_holder?.trim() || !bankCode) {
        toast.error(
          t(
            'xendit.payoutValidation.bankDetailsRequired',
            'Lengkapi bank, nomor rekening, dan nama pemilik sebelum validasi.',
          ),
        );
        return;
      }
      await validateGatewayPayoutBank(organizationId, {
        bank_account_id: bankAccount.id,
        bank_code: bankCode,
        account_number: bankAccount.account_number,
        account_holder: bankAccount.account_holder,
        enable_payout: true,
      });
      toast.success(
        t('xendit.payoutValidation.success', 'Rekening payout tervalidasi.'),
      );
      void queryClient.invalidateQueries({ queryKey: ['xendit-settings', organizationId] });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      await refetch();
    } finally {
      setTogglingGatewayPayoutId(null);
    }
  };

  const handleLinkBrick = async (bankAccountId: string) => {
    setBrickActionId(bankAccountId);
    try {
      await linkBrick(bankAccountId);
      await refetch();
    } finally {
      setBrickActionId(null);
    }
  };

  const handleUnlinkBrick = async (bankAccountId: string) => {
    setBrickActionId(bankAccountId);
    try {
      await unlinkBrick(bankAccountId);
      await refetch();
    } finally {
      setBrickActionId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {t('incomes.bankAccounts.title', 'Bank Accounts')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t(
              'incomes.brick.accountsHint',
              'Hubungkan rekening via Brick Widget (OAuth) untuk mutasi & saldo otomatis.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />
              {t('incomes.bankAccounts.add', 'Add Bank Account')}
            </Button>
          ) : null}
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="p-3 border rounded-lg bg-gray-50 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Account Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter account name"
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_name" className="text-xs">Bank Name</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
                placeholder="Mandiri, BCA, BRI…"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account_number" className="text-xs">Account Number</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, account_number: e.target.value }))
                }
                placeholder="Enter account number"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account_holder" className="text-xs">Account Holder</Label>
              <Input
                id="account_holder"
                value={formData.account_holder}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, account_holder: e.target.value }))
                }
                placeholder="Enter account holder name"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} size="sm" className="h-8 text-xs">
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {editingBankAccount ? 'Updating...' : 'Creating...'}
                </>
              ) : editingBankAccount ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={submitting}
              size="sm"
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 flex-shrink-0">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading bank accounts...</span>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden flex-shrink-0 flex flex-col max-h-[320px]">
          <div className="overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain min-h-0 flex-1">
            <Table className="min-w-[1080px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%] text-xs">Name</TableHead>
                  <TableHead className="w-[8%] text-xs">Bank</TableHead>
                  <TableHead className="min-w-[10rem] w-[18%] text-xs">Account Number</TableHead>
                  <TableHead className="w-[14%] text-xs">Brick</TableHead>
                  <TableHead className="w-[16%] text-xs">
                    {t('incomes.brick.balanceCompare', 'Saldo ERP / Brick')}
                  </TableHead>
                  <TableHead className="text-xs w-24 shrink-0">
                    {t('incomes.bankAccounts.omnichannelToggle', 'Omnichannel')}
                  </TableHead>
                  <TableHead className="text-xs w-28 shrink-0">
                    {t('incomes.bankAccounts.gatewayPayoutToggle', 'Gateway payout')}
                  </TableHead>
                  <TableHead className="text-xs w-28 shrink-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((bankAccount) => {
                  const erp = erpBalanceByAccount.get(bankAccount.id);
                  const brickBusy =
                    brickActionId === bankAccount.id || linkingBrick || unlinkingBrick;

                  return (
                    <TableRow key={bankAccount.id}>
                      <TableCell className="text-xs font-medium">{bankAccount.name}</TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {bankAccount.bank_name || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                        {bankAccount.account_number || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <BrickLinkStatusBadge
                          status={bankAccount.brick_link_status}
                          lastSyncAt={bankAccount.brick_last_sync_at}
                          lastSyncError={bankAccount.brick_last_sync_error}
                          busy={brickBusy}
                          i18nPrefix="incomes.brick"
                          t={t}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="text-[10px] leading-snug">
                          ERP: {formatToRupiah(erp ?? 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {bankAccount.is_active ? (
                          <Switch
                            checked={!!bankAccount.use_for_omnichannel_income}
                            disabled={togglingOmnichannelId === bankAccount.id}
                            onCheckedChange={(checked) =>
                              handleOmnichannelToggle(bankAccount, checked)
                            }
                            aria-label={t(
                              'incomes.bankAccounts.omnichannelToggleAria',
                              'Use for livechat conversion payments',
                            )}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Switch checked={false} disabled aria-hidden />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(
                                'incomes.bankAccounts.omnichannelInactiveHint',
                                'Activate this bank account before enabling Omnichannel.',
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {bankAccount.is_active ? (
                          (() => {
                            const isVerifiedPayout =
                              !!bankAccount.use_for_gateway_payout &&
                              bankAccount.gateway_payout_validation_status === 'match';
                            const isPending =
                              bankAccount.gateway_payout_validation_status === 'pending';
                            const isToggling = togglingGatewayPayoutId === bankAccount.id;
                            const tooltip = isVerifiedPayout
                              ? t(
                                  'xendit.payoutValidation.toggleVerified',
                                  'Rekening payout tervalidasi — aktif untuk penarikan Xendit',
                                )
                              : isPending
                              ? t(
                                  'xendit.payoutValidation.togglePending',
                                  'Validasi rekening sedang berjalan…',
                                )
                              : t(
                                  'xendit.payoutValidation.toggleOff',
                                  'Aktifkan untuk validasi rekening ke bank. Toggle hanya ON jika verifikasi MATCH.',
                                );

                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Switch
                                      checked={!!bankAccount.use_for_gateway_payout}
                                      disabled={isToggling || isPending}
                                      className={cn(
                                        isVerifiedPayout &&
                                          'data-[state=checked]:bg-emerald-600 data-[state=checked]:hover:bg-emerald-600',
                                      )}
                                      onCheckedChange={(checked) =>
                                        void handleGatewayPayoutToggle(bankAccount, checked)
                                      }
                                      aria-label={tooltip}
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  {tooltip}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Switch checked={false} disabled aria-hidden />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(
                                'incomes.bankAccounts.gatewayPayoutInactiveHint',
                                'Activate this bank account before enabling gateway payout.',
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canAllocateIncome &&
                          bankAccount.brick_link_status !== 'linked' &&
                          bankAccount.is_active ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={brickBusy}
                                  onClick={() => handleLinkBrick(bankAccount.id)}
                                >
                                  <Link2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('incomes.brick.linkAction', 'Hubungkan via Brick Widget')}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          {canAllocateIncome && bankAccount.brick_link_status === 'linked' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={brickBusy}
                                  onClick={() => handleUnlinkBrick(bankAccount.id)}
                                >
                                  <Unlink className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('incomes.brick.unlinkAction', 'Putuskan Brick')}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(bankAccount)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(bankAccount.id)}
                            className="h-7 w-7 p-0 text-brand-red hover:text-brand-red/90"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {bankAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-xs text-gray-500">
                      No bank accounts found. Click &quot;Add Bank Account&quot; to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

    </div>
  );
};
