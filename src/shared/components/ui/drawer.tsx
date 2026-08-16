import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/shared/lib/utils";
import { useMobileChromeReflowOnForeground } from "@/shared/mobile/useMobileChromeReflowOnForeground";
import { useRegisterMobileAppNavSuppression } from "@/shared/mobile/MobileAppNavSuppressionContext";

/** Vaul close animation; keep nav suppression until this elapses so `bottom` does not jump mid-slide. */
const DRAWER_CLOSE_ANIMATION_MS = 500;

const Drawer = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-20 bg-black/80", className)} {...props} />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> {
  overlayClassName?: string;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>(({ className, overlayClassName, children, ...props }, ref) => {
  const mergedClassName = cn(
    /* modal-above-safe-area: bottom edge di atas gesture / tombol nav sistem (sama seperti dialog fullscreen) */
    "fixed inset-x-0 z-20 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background modal-above-safe-area",
    className,
  );
  useMobileChromeReflowOnForeground();
  const shell = mergedClassName.includes("modal-above-safe-area");
  const [drawerSurfaceOpen, setDrawerSurfaceOpen] = React.useState(false);
  const moRef = React.useRef<MutationObserver | null>(null);
  const closeDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (closeDelayRef.current != null) {
        clearTimeout(closeDelayRef.current);
        closeDelayRef.current = null;
      }
    };
  }, []);

  const setContentNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      moRef.current?.disconnect();
      moRef.current = null;
      if (closeDelayRef.current != null) {
        clearTimeout(closeDelayRef.current);
        closeDelayRef.current = null;
      }
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
      if (!node || !shell) {
        setDrawerSurfaceOpen(false);
        return;
      }
      const sync = () => {
        const isOpen = node.getAttribute("data-state") === "open";
        if (isOpen) {
          if (closeDelayRef.current != null) {
            clearTimeout(closeDelayRef.current);
            closeDelayRef.current = null;
          }
          setDrawerSurfaceOpen(true);
          return;
        }
        if (closeDelayRef.current != null) clearTimeout(closeDelayRef.current);
        closeDelayRef.current = setTimeout(() => {
          closeDelayRef.current = null;
          if (node.getAttribute("data-state") !== "open") {
            setDrawerSurfaceOpen(false);
          }
        }, DRAWER_CLOSE_ANIMATION_MS);
      };
      sync();
      const mo = new MutationObserver(sync);
      mo.observe(node, { attributes: true, attributeFilter: ["data-state"] });
      moRef.current = mo;
    },
    [ref, shell],
  );

  useRegisterMobileAppNavSuppression(shell && drawerSurfaceOpen);

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content ref={setContentNode} className={mergedClassName} {...props}>
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
