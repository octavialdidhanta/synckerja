import { cn } from "@/shared/lib/utils";
import type { OpsBankAccount } from "../hooks/useOpsBankAccounts";
import { normalizeIndonesiaBankName } from "../lib/indonesiaBanks";

type Props = {
  accounts: OpsBankAccount[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function BankAccountList({ accounts, selectedId, onSelect }: Props) {
  if (accounts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {accounts.map((account) => {
        const active = account.id === selectedId;
        const bankLabel =
          normalizeIndonesiaBankName(account.bank_name || account.name) ||
          account.bank_name ||
          account.name;
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            className={cn(
              "flex w-full flex-col rounded-md border px-4 py-3 text-left transition-colors",
              active
                ? "border-primary bg-primary/5"
                : "border-border bg-white hover:bg-muted/40",
            )}
          >
            <span className="truncate whitespace-nowrap text-sm font-medium text-foreground">
              {bankLabel}
            </span>
            <span className="truncate whitespace-nowrap text-xs text-muted-foreground">
              {account.account_number}
              {account.account_holder ? ` · ${account.account_holder}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
