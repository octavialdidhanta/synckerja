import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import {
  useOpsBankAccounts,
  type OpsBankAccount,
} from "../hooks/useOpsBankAccounts";
import { useBankAccountOutlets } from "../hooks/useBankAccountOutlets";
import { normalizeIndonesiaBankName } from "../lib/indonesiaBanks";
import { BankAccountFormSection } from "./BankAccountFormSection";
import { AssignBankOutletDialog } from "./AssignBankOutletDialog";

const emptyForm = {
  bankName: "",
  accountNumber: "",
  accountHolder: "",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode */
  account: OpsBankAccount | null;
};

export function BankAccountFormSheet({ open, onOpenChange, account }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving, deactivate, isDeactivating } = useOpsBankAccounts();
  const { rows: outlets } = usePosOutlets();
  const isCreating = !account;

  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pendingOutletIds, setPendingOutletIds] = useState<string[]>([]);

  const {
    outletIds,
    allAssignments,
    saveOutlets,
    isSaving: outletsSaving,
  } = useBankAccountOutlets(isCreating ? null : account?.id ?? null);

  useEffect(() => {
    if (!open) {
      setAssignOpen(false);
      return;
    }
    if (account) {
      setForm({
        bankName: normalizeIndonesiaBankName(
          account.bank_name || account.name,
        ),
        accountNumber: account.account_number ?? "",
        accountHolder: account.account_holder ?? "",
      });
    } else {
      setForm(emptyForm);
      setPendingOutletIds([]);
    }
    setDirty(false);
  }, [open, account?.id]);

  const outletIdsKey = outletIds.join("|");
  useEffect(() => {
    if (!open || isCreating || !account?.id) return;
    setPendingOutletIds((prev) =>
      prev.length === outletIds.length &&
      [...prev].sort().join("|") === [...outletIds].sort().join("|")
        ? prev
        : outletIds,
    );
  }, [outletIdsKey, outletIds, open, isCreating, account?.id]);

  const assignedOutletNames = useMemo(() => {
    const map = new Map(outlets.map((o) => [o.id, o.name]));
    return pendingOutletIds
      .map((id) => map.get(id))
      .filter((name): name is string => Boolean(name));
  }, [outlets, pendingOutletIds]);

  const canSave =
    Boolean(form.bankName.trim()) &&
    Boolean(form.accountNumber.trim()) &&
    Boolean(form.accountHolder.trim()) &&
    dirty;

  const handleSave = async () => {
    if (!canSave) {
      toast({
        title: t(
          "settings.bankAccount.validation",
          "Please fill bank name, account number, and account holder",
        ),
        variant: "destructive",
      });
      return;
    }
    const saved = await save({
      id: isCreating ? null : account?.id ?? null,
      values: form,
    });
    if (pendingOutletIds.length > 0 || (!isCreating && outletIds.length > 0)) {
      await saveOutlets({
        bankAccountId: saved.id,
        outletIds: pendingOutletIds,
      });
    }
    setDirty(false);
    onOpenChange(false);
  };

  const handleAssignConfirm = async (ids: string[]) => {
    setPendingOutletIds(ids);
    if (account?.id) {
      // Persist immediately when editing so Assign works without needing Save
      await saveOutlets({
        bankAccountId: account.id,
        outletIds: ids,
      });
      return;
    }
    setDirty(true);
  };

  const title = isCreating
    ? t("settings.bankAccount.addBankAccount", "Add Bank Account")
    : t("settings.bankAccount.editBankAccount", "Edit Bank Account");

  const assignedNamesEmpty = pendingOutletIds.length === 0;
  const busy = isSaving || outletsSaving;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          // Nested Assign dialog must not dismiss this sheet
          if (!next && assignOpen) return;
          onOpenChange(next);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (assignOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (assignOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (assignOpen) {
              e.preventDefault();
              setAssignOpen(false);
            }
          }}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <BankAccountFormSection
              bankName={form.bankName}
              accountNumber={form.accountNumber}
              accountHolder={form.accountHolder}
              onBankNameChange={(v) => {
                setForm((f) => ({ ...f, bankName: v }));
                setDirty(true);
              }}
              onAccountNumberChange={(v) => {
                setForm((f) => ({ ...f, accountNumber: v }));
                setDirty(true);
              }}
              onAccountHolderChange={(v) => {
                setForm((f) => ({ ...f, accountHolder: v }));
                setDirty(true);
              }}
              disabled={busy}
            />

            <section className="rounded-md border border-border bg-white p-4">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("settings.bankAccount.assignedOutlets", "Assigned Outlets")}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              {assignedNamesEmpty ? (
                <p className="mb-3 text-center text-sm text-muted-foreground">
                  {t(
                    "settings.bankAccount.noOutletsAssigned",
                    "No outlets assigned",
                  )}
                </p>
              ) : (
                <div className="mb-3 space-y-1 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "settings.bankAccount.outletCount",
                      "{{count}} outlet(s) assigned",
                      { count: pendingOutletIds.length },
                    )}
                  </p>
                  {assignedOutletNames.length > 0 ? (
                    <p className="text-xs text-foreground">
                      {assignedOutletNames.join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-primary text-primary"
                onClick={() => setAssignOpen(true)}
                disabled={busy}
              >
                {t("settings.bankAccount.assignOutlet", "Assign Outlet")}
              </Button>
              {!isCreating && account?.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 h-9 w-full text-destructive"
                  disabled={isDeactivating || busy}
                  onClick={async () => {
                    await deactivate(account.id);
                    onOpenChange(false);
                  }}
                >
                  {t("settings.bankAccount.deactivate", "Deactivate account")}
                </Button>
              ) : null}
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || busy}
            >
              {t("common.save", "Save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AssignBankOutletDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        bankName={form.bankName}
        accountNumber={form.accountNumber}
        bankAccountId={isCreating ? null : account?.id ?? null}
        selectedIds={pendingOutletIds}
        allAssignments={allAssignments}
        busy={outletsSaving}
        onConfirm={handleAssignConfirm}
      />
    </>
  );
}
