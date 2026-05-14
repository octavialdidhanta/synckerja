import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import type { RecipientPickerCandidate } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";
import { RECIPIENT_PICKER_MAX_SELECT } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";

type AddContactsToRecipientListModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: RecipientPickerCandidate[];
  candidatesLoading: boolean;
  /** When set, show instead of empty list (e.g. failed Supabase fetch). */
  candidatesError?: string | null;
  onSubmit: (args: { name: string; picks: RecipientPickerCandidate[] }) => Promise<void>;
  isSubmitting: boolean;
};

export function AddContactsToRecipientListModal({
  open,
  onOpenChange,
  candidates,
  candidatesLoading,
  candidatesError = null,
  onSubmit,
  isSubmitting,
}: AddContactsToRecipientListModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setName("");
      setQ("");
      setSelected(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return candidates;
    return candidates.filter(
      (c) =>
        c.displayName.toLowerCase().includes(s) ||
        c.displayPhone.toLowerCase().includes(s) ||
        c.phoneKey.includes(s),
    );
  }, [candidates, q]);

  const allFilteredKeys = useMemo(() => filtered.map((c) => c.phoneKey), [filtered]);
  const allSelected =
    filtered.length > 0 && allFilteredKeys.length > 0 && allFilteredKeys.every((k) => selected.has(k));

  const toggleOne = useCallback((key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleAllFiltered = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) {
          for (const c of filtered) {
            if (next.size >= RECIPIENT_PICKER_MAX_SELECT) break;
            next.add(c.phoneKey);
          }
        } else {
          for (const c of filtered) next.delete(c.phoneKey);
        }
        return next;
      });
    },
    [filtered],
  );

  const picks = useMemo(
    () => candidates.filter((c) => selected.has(c.phoneKey)),
    [candidates, selected],
  );

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || picks.length === 0) return;
    if (picks.length > RECIPIENT_PICKER_MAX_SELECT) return;
    try {
      await onSubmit({ name: trimmed.slice(0, 60), picks });
      onOpenChange(false);
    } catch {
      /* error surfaced by parent; keep modal open */
    }
  };

  const nameLen = name.length;
  const addDisabled =
    isSubmitting ||
    !name.trim() ||
    picks.length === 0 ||
    picks.length > RECIPIENT_PICKER_MAX_SELECT ||
    candidatesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle className="text-base font-semibold">
            {t("whatsappTemplates.recipientLists.addContactsModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="recipient-list-name">
              {t("whatsappTemplates.recipientLists.addContactsModal.listNameLabel")}
              <span className="text-destructive"> *</span>
            </label>
            <div className="relative">
              <Input
                id="recipient-list-name"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("whatsappTemplates.recipientLists.addContactsModal.listNamePlaceholder")}
                className="pr-16"
                disabled={isSubmitting}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {nameLen}/60
              </span>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50/90 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <AlertDescription className="text-sm">
              {t("whatsappTemplates.recipientLists.addContactsModal.infoBanner")}
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("whatsappTemplates.recipientLists.addContactsModal.searchPlaceholder")}
              className="h-9 max-w-xs flex-1 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {t("whatsappTemplates.recipientLists.addContactsModal.selectedCount", {
                count: picks.length,
                max: RECIPIENT_PICKER_MAX_SELECT,
              })}
            </span>
          </div>

          <div className="min-h-[200px] flex-1 overflow-auto rounded-md border border-border">
            {candidatesLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("whatsappTemplates.recipientLists.addContactsModal.loading")}
              </div>
            ) : candidatesError ? (
              <Alert variant="destructive" className="m-3 border-destructive/50">
                <AlertDescription className="text-sm">
                  {t("whatsappTemplates.recipientLists.addContactsModal.loadError", { message: candidatesError })}
                </AlertDescription>
              </Alert>
            ) : filtered.length === 0 ? (
              <div className="space-y-2 px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t("whatsappTemplates.recipientLists.addContactsModal.empty")}</p>
                <p className="text-xs text-muted-foreground/90">{t("whatsappTemplates.recipientLists.addContactsModal.emptyHint")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 px-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAllFiltered(v === true)}
                        aria-label={t("whatsappTemplates.recipientLists.addContactsModal.selectAllAria")}
                      />
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      {t("whatsappTemplates.recipientLists.addContactsModal.colName")}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      {t("whatsappTemplates.recipientLists.addContactsModal.colPhone")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.phoneKey} className="h-10">
                      <TableCell className="px-2 py-1">
                        <Checkbox
                          checked={selected.has(row.phoneKey)}
                          onCheckedChange={(v) => toggleOne(row.phoneKey, v === true)}
                          aria-label={row.displayName}
                        />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate py-1 text-sm font-medium" title={row.displayName}>
                        {row.displayName}
                      </TableCell>
                      <TableCell className="py-1 text-sm tabular-nums text-muted-foreground">{row.displayPhone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("whatsappTemplates.recipientLists.addContactsModal.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleAdd()} disabled={addDisabled}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("whatsappTemplates.recipientLists.addContactsModal.saving")}
              </>
            ) : (
              t("whatsappTemplates.recipientLists.addContactsModal.add")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
