import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import type { LeadMagnetAccountChoiceOption } from '@/6-1-lead-magnet/lib/leadMagnetApi';

type AccountChoiceDialogProps = {
  open: boolean;
  confirming: boolean;
  instagram: LeadMagnetAccountChoiceOption[];
  facebook: LeadMagnetAccountChoiceOption[];
  instagramId: string;
  facebookId: string;
  onInstagramId: (value: string) => void;
  onFacebookId: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  instagramLabel: string;
  facebookLabel: string;
  ineligibleLabel: string;
  emptyLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmingLabel: string;
};

function AccountList({
  name,
  accounts,
  value,
  onChange,
  emptyLabel,
  ineligibleLabel,
}: {
  name: string;
  accounts: LeadMagnetAccountChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  ineligibleLabel: string;
}) {
  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-2">
      {accounts.map((account) => {
        const id = `${name}-${account.account_id}`;
        return (
          <div key={account.account_id} className="flex items-start gap-2 rounded-md border px-3 py-2">
            <RadioGroupItem id={id} value={account.account_id} disabled={!account.eligible} className="mt-0.5" />
            <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 font-normal">
              <span className="truncate">{account.label}</span>
              {!account.eligible ? <span className="text-xs text-muted-foreground">{ineligibleLabel}</span> : null}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

export function LeadMagnetAccountChoiceDialog({
  open,
  confirming,
  instagram,
  facebook,
  instagramId,
  facebookId,
  onInstagramId,
  onFacebookId,
  onConfirm,
  onCancel,
  title,
  description,
  instagramLabel,
  facebookLabel,
  ineligibleLabel,
  emptyLabel,
  confirmLabel,
  cancelLabel,
  confirmingLabel,
}: AccountChoiceDialogProps) {
  const instagramReady = instagram.some((account) => account.eligible)
    ? instagram.some((account) => account.eligible && account.account_id === instagramId)
    : true;
  const facebookReady = facebook.some((account) => account.eligible)
    ? facebook.some((account) => account.eligible && account.account_id === facebookId)
    : true;
  const canConfirm = instagramReady && facebookReady && (Boolean(instagramId) || Boolean(facebookId));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col sm:max-w-lg" style={{ zIndex: 1000000 }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{instagramLabel}</h3>
            <AccountList
              name="instagram"
              accounts={instagram}
              value={instagramId}
              onChange={onInstagramId}
              emptyLabel={emptyLabel}
              ineligibleLabel={ineligibleLabel}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{facebookLabel}</h3>
            <AccountList
              name="facebook"
              accounts={facebook}
              value={facebookId}
              onChange={onFacebookId}
              emptyLabel={emptyLabel}
              ineligibleLabel={ineligibleLabel}
            />
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!canConfirm || confirming}>
            {confirming ? confirmingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
