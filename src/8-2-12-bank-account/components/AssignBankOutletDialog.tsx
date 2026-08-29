import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import type { BankAccountOutletRow } from "../hooks/useBankAccountOutlets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankName: string;
  accountNumber: string;
  bankAccountId: string | null;
  selectedIds: string[];
  allAssignments: BankAccountOutletRow[];
  onConfirm: (ids: string[]) => void | Promise<void>;
  busy?: boolean;
};

export function AssignBankOutletDialog({
  open,
  onOpenChange,
  bankName,
  accountNumber,
  bankAccountId,
  selectedIds,
  allAssignments,
  onConfirm,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  const { rows, isLoading } = usePosOutlets();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [confirming, setConfirming] = useState(false);

  // Only hydrate draft when the dialog opens — do not reset on every parent re-render
  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery("");
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open-only hydrate
  }, [open]);

  const assignedElsewhere = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allAssignments) {
      if (bankAccountId && row.bank_account_id === bankAccountId) continue;
      map.set(row.outlet_id, row.bank_account_id);
    }
    return map;
  }, [allAssignments, bankAccountId]);

  const outletRows = useMemo(
    () => rows.filter((row) => row.is_active !== false),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return outletRows;
    return outletRows.filter((row) => row.name.toLowerCase().includes(q));
  }, [outletRows, query]);

  const filteredIds = filtered.map((r) => r.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => draftIds.includes(id));

  const toggle = (id: string, checked: boolean) => {
    setDraftIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const drop = new Set(filteredIds);
      setDraftIds((prev) => prev.filter((id) => !drop.has(id)));
      return;
    }
    setDraftIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(draftIds);
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  const locked = busy || confirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        overlayClassName="z-[80]"
        className="z-[80] gap-0 overflow-hidden p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("settings.bankAccount.assignOutletTitle", "Assign Outlet")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              {t("settings.bankAccount.assignTo", "Assign to")}
            </p>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{bankName || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.bankAccount.accountNumber", "Account Number")}
                {accountNumber ? `: ${accountNumber}` : ""}
              </p>
            </div>
          </div>

          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("outlets.assign.search", "Search")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-left"
              onClick={handleSelectAll}
            >
              <Checkbox
                checked={allFilteredSelected}
                className="pointer-events-none"
                tabIndex={-1}
                aria-hidden
              />
              <span className="flex-1 text-xs font-medium">
                {t("outlets.assign.selectAll", "Select all")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("settings.bankAccount.assignedToCol", "Assigned to")}
              </span>
            </button>
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("outlets.loading", "Loading...")}
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("settings.bankAccount.noOutlets", "No outlets found")}
              </p>
            ) : (
              filtered.map((outlet) => {
                const checked = draftIds.includes(outlet.id);
                const elsewhere = assignedElsewhere.get(outlet.id);
                const status = checked
                  ? t("settings.bankAccount.statusAssigned", "Assigned")
                  : elsewhere
                    ? t(
                        "settings.bankAccount.statusAssignedOther",
                        "Assigned elsewhere",
                      )
                    : t("settings.bankAccount.statusUnassigned", "Unassigned");
                return (
                  <button
                    key={outlet.id}
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40"
                    onClick={() => toggle(outlet.id, !checked)}
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none"
                      tabIndex={-1}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {outlet.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {status}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-4 py-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("settings.bankAccount.selectedCount", "Selected:")}{" "}
            <span className="font-semibold text-foreground">
              {draftIds.length === 0
                ? t("settings.bankAccount.selectedNone", "None")
                : draftIds.length}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={locked}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={locked}
            >
              {t("settings.bankAccount.assign", "Assign")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
