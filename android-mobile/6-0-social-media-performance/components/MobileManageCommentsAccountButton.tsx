import { useEffect, useRef, useState } from "react";
import { CircleUser } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";

type AccountOption = { value: string; label: string; hint?: string };

type MobileManageCommentsAccountButtonProps = {
  accounts: AccountOption[];
  accountId: string;
  onAccountIdChange: (id: string) => void;
  accountsLoading?: boolean;
};

export function MobileManageCommentsAccountButton({
  accounts,
  accountId,
  onAccountIdChange,
  accountsLoading,
}: MobileManageCommentsAccountButtonProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const pendingAccountIdRef = useRef<string | null>(null);
  const applyAccountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = accounts.find((account) => account.value === accountId);

  useEffect(() => {
    return () => {
      if (applyAccountTimerRef.current != null) {
        clearTimeout(applyAccountTimerRef.current);
      }
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) return;
    const nextId = pendingAccountIdRef.current;
    pendingAccountIdRef.current = null;
    if (!nextId || nextId === accountId) return;
    if (applyAccountTimerRef.current != null) {
      clearTimeout(applyAccountTimerRef.current);
    }
    applyAccountTimerRef.current = setTimeout(() => {
      applyAccountTimerRef.current = null;
      onAccountIdChange(nextId);
    }, 450);
  };

  if (accountsLoading || accounts.length <= 1) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={
          selected?.label
            ? t("digitalMarketing.manageComments.switchAccountNamed", "Switch account: {{name}}", {
                name: selected.label,
              })
            : t("digitalMarketing.manageComments.switchAccount", "Switch account")
        }
        onClick={() => setOpen(true)}
      >
        <CircleUser className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Button>

      <Drawer
        shouldScaleBackground={false}
        modal
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.socialMediaInsightReport.colAccount", "Account")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {accounts.map((account) => {
              const isActive = account.value === accountId;
              return (
                <button
                  key={account.value}
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    if (account.value !== accountId) {
                      pendingAccountIdRef.current = account.value;
                    }
                    handleOpenChange(false);
                  }}
                >
                  <span className="truncate">{account.label}</span>
                  {account.hint ? (
                    <span className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      {account.hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

MobileManageCommentsAccountButton.displayName = "MobileManageCommentsAccountButton";
