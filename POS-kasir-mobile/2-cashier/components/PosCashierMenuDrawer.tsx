import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  PosSessionLeaveProvider,
  usePosSessionLeave,
} from "@/pos-mobile/shared/PosSessionLeaveProvider";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { usePosCashierIsPhoneLayout } from "../hooks/usePosCashierIsPhoneLayout";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";
import { PosSidebarFooter } from "./sidebar/PosSidebarFooter";
import { PosSidebarNav } from "./sidebar/PosSidebarNav";
import type { PosSidebarItem, PosSidebarItemId } from "./sidebar/posSidebarItems";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletName?: string | null;
  /** Active nav id — defaults to Point of Sale on cashier. */
  activeId?: PosSidebarItemId;
};

function PosCashierMenuDrawerInner({
  open,
  onOpenChange,
  outletName,
  activeId = "pointOfSale",
}: Props) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const leave = usePosSessionLeave();
  const isPhone = usePosCashierIsPhoneLayout();

  const switchOutlet = () => {
    onOpenChange(false);
    leave.requestLeave("switch-outlet");
  };

  const logout = () => {
    onOpenChange(false);
    leave.requestLeave("logout");
  };

  const onSelect = (item: PosSidebarItem) => {
    onOpenChange(false);
    if (item.soon) {
      toast({ title: t(POS_CASHIER_I18N.soon, "Coming soon") });
      return;
    }
    navigate(item.path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        /* Above End Shift / leave-gate overlays (z-70) and other POS sheets so Menu stays reachable. */
        overlayClassName="z-[100]"
        className={cn(
          "z-[100] flex w-72 flex-col gap-0 border-0 bg-primary p-0 text-white shadow-xl sm:max-w-sm",
          /* Default Sheet X is absolute top-right of the panel — hide; use header-aligned close. */
          "[&>button]:hidden",
        )}
      >
        {isPhone ? <PosSafeAreaTopSpacer tone="primary" /> : null}
        <SheetHeader className="flex-shrink-0 space-y-1 border-b border-white/20 px-4 py-3 text-left">
          <div className="flex items-start gap-0.5">
            <SynckerjaBrandMark
              size="sm"
              className="-ml-1.5 shrink-0 object-left brightness-0 invert"
            />
            <div className="-ml-0.5 mt-1 flex min-w-0 flex-1 items-center gap-2">
              <SheetTitle className="min-w-0 flex-1 text-base font-semibold leading-none text-white">
                {t(POS_CASHIER_I18N.brandTitle, "Synckerja POS")}
              </SheetTitle>
              <SheetClose
                className={cn(
                  "-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  "text-white opacity-90 transition-opacity hover:bg-white/15 hover:opacity-100",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                )}
                aria-label={t("layout.sheetClose", "Close")}
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>
          </div>
          {outletName ? (
            <p className="text-sm font-normal leading-snug text-white/80">
              {outletName}
            </p>
          ) : null}
        </SheetHeader>

        <PosSidebarNav activeId={activeId} onSelect={onSelect} />

        <PosSidebarFooter onSwitchOutlet={switchOutlet} onLogout={logout} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Brand-blue POS sidebar drawer (Menu from bottom nav).
 * Wraps leave-gate provider when not already nested (settings page may provide it).
 */
export function PosCashierMenuDrawer(props: Props) {
  return (
    <PosSessionLeaveProvider>
      <PosCashierMenuDrawerInner {...props} />
    </PosSessionLeaveProvider>
  );
}
