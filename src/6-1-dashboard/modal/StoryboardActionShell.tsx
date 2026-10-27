import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useIsMobile } from "@/shared/hooks/use-mobile";

type OutsideEvent = { preventDefault: () => void; target: EventTarget | null };

export function StoryboardActionShell({
  open,
  onOpenChange,
  title,
  headerExtra,
  children,
  footer,
  footerClassName,
  keepOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  footerClassName?: string;
  keepOpen?: (event: OutsideEvent) => void;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} repositionInputs={false} onOpenChange={onOpenChange}>
        <DrawerContent
          className="z-[120] flex max-h-[min(85dvh,40rem)] flex-col overflow-hidden px-0"
          overlayClassName="z-[120]"
          onPointerDownOutside={keepOpen}
          onFocusOutside={keepOpen}
          onInteractOutside={keepOpen}
        >
          <DrawerHeader className="shrink-0 px-4 pb-2 text-left">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
            {headerExtra}
          </DrawerHeader>
          <div
            data-vaul-no-drag
            className="scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {children}
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex aspect-square !h-auto !w-[min(32rem,88vmin)] !max-w-[88vmin] flex-col overflow-hidden rounded-none sm:rounded-none"
        onPointerDownOutside={keepOpen}
        onFocusOutside={keepOpen}
        onInteractOutside={keepOpen}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {headerExtra}
        </DialogHeader>
        <div className="scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        <DialogFooter className={footerClassName}>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
