import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useOpsBankAccounts } from "../hooks/useOpsBankAccounts";
import { BankAccountList } from "./BankAccountList";
import { BankAccountFormSheet } from "./BankAccountFormSheet";
import { BankAccountActivityLogSheet } from "./BankAccountActivityLogSheet";

export function BankAccountSettingsPanel() {
  const { t } = useAppTranslation();
  const { accounts, isLoading } = useOpsBankAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const editingAccount =
    editingId == null
      ? null
      : (accounts.find((a) => a.id === editingId) ?? null);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  if (isLoading) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-primary text-primary"
          onClick={() => setLogOpen(true)}
        >
          {t("settings.bankAccount.activityLog", "Activity Log")}
        </Button>
        <Button type="button" onClick={openCreate}>
          {t("settings.bankAccount.addBank", "Add Bank")}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-border bg-white px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              "settings.bankAccount.emptyList",
              "No bank accounts yet. Click Add Bank to create one.",
            )}
          </p>
          <Button type="button" className="mt-4" onClick={openCreate}>
            {t("settings.bankAccount.addBankAccount", "Add Bank Account")}
          </Button>
        </div>
      ) : (
        <BankAccountList
          accounts={accounts}
          selectedId={formOpen ? editingId : null}
          onSelect={openEdit}
        />
      )}

      <BankAccountFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        account={editingAccount}
      />

      <BankAccountActivityLogSheet open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
