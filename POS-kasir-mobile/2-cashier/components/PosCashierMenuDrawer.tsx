import { useNavigate } from "react-router-dom";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import {
  Sheet,
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
        className={cn(
          "flex w-72 flex-col gap-0 border-0 bg-primary p-0 text-white shadow-xl sm:max-w-sm",
          "[&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100",
          "[&>button]:ring-offset-primary [&>button]:focus:ring-white/40",
        )}
      >
        <SheetHeader className="flex-shrink-0 space-y-1 border-b border-white/20 px-4 py-4 pr-12 text-left">
          <div className="flex items-center gap-2">
            <SynckerjaBrandMark size="sm" className="brightness-0 invert" />
            <SheetTitle className="text-base font-semibold text-white">
              {t(POS_CASHIER_I18N.brandTitle, "Synckerja POS")}
            </SheetTitle>
          </div>
          {outletName ? (
            <p className="text-sm font-normal text-white/80">{outletName}</p>
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
