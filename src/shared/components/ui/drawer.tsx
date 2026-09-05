import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/shared/lib/utils";
import { useMobileChromeReflowOnForeground } from "@/shared/mobile/useMobileChromeReflowOnForeground";
import { useRegisterMobileAppNavSuppression } from "@/shared/mobile/MobileAppNavSuppressionContext";

/** Vaul default close (~500ms); keep nav suppression until slide finishes. */
const DRAWER_CLOSE_ANIMATION_MS = 500;
/** Match `pos-smooth-drawer` CSS (200ms). */
const DRAWER_FAST_CLOSE_ANIMATION_MS = 220;

const Drawer = ({
  shouldScaleBackground = false,
  closeThreshold = 0.12,
  scrollLockTimeout = 50,
  /** Android adjustResize already shrinks the WebView; Vaul's default shift double-lifts the sheet. */
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    closeThreshold={closeThreshold}
    scrollLockTimeout={scrollLockTimeout}
    repositionInputs={repositionInputs}
    {...props}
  />
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
  /**
   * When true (default), pin above app tab bar via `modal-above-safe-area` + nav suppression.
   * Set false for POS / standalone sheets that should stay `bottom-0` (no close jump).
   */
  aboveAppNav?: boolean;
  /** Faster 200ms close; swipe tracks the finger (no CSS lag). Default on when aboveAppNav is false (POS). */
  smoothFast?: boolean;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>(({ className, overlayClassName, children, aboveAppNav = true, smoothFast, onPointerDown, ...props }, ref) => {
  const useFastClose = smoothFast ?? !aboveAppNav;
  const mergedClassName = cn(
    "fixed inset-x-0 z-20 flex flex-col rounded-t-[10px] border bg-background",
    aboveAppNav
      ? "mt-24 h-auto modal-above-safe-area"
      : "bottom-0 mt-0 h-auto",
    useFastClose && "pos-smooth-drawer",
    className,
  );
  useMobileChromeReflowOnForeground();
  const shell = aboveAppNav;
  const closeMs = useFastClose ? DRAWER_FAST_CLOSE_ANIMATION_MS : DRAWER_CLOSE_ANIMATION_MS;
  const [drawerSurfaceOpen, setDrawerSurfaceOpen] = React.useState(false);
  const moRef = React.useRef<MutationObserver | null>(null);
  const closeDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentElRef = React.useRef<HTMLDivElement | null>(null);
  const overlayElRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef(false);

  const setDragging = React.useCallback((next: boolean) => {
    draggingRef.current = next;
    contentElRef.current?.classList.toggle("pos-smooth-drawer-dragging", next);
    overlayElRef.current?.classList.toggle("pos-smooth-drawer-dragging", next);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeDelayRef.current != null) {
        clearTimeout(closeDelayRef.current);
        closeDelayRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!useFastClose) return;
    const endDrag = () => setDragging(false);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [useFastClose, setDragging]);

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
      contentElRef.current = node;
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
        }, closeMs);
      };
      sync();
      const mo = new MutationObserver(sync);
      mo.observe(node, { attributes: true, attributeFilter: ["data-state"] });
      moRef.current = mo;
    },
    [ref, shell, closeMs],
  );

  useRegisterMobileAppNavSuppression(shell && drawerSurfaceOpen);

  return (
    <DrawerPortal>
      <DrawerOverlay
        ref={overlayElRef}
        className={cn(
          useFastClose && "pos-smooth-drawer-overlay",
          overlayClassName,
        )}
      />
      <DrawerPrimitive.Content
        ref={setContentNode}
        className={mergedClassName}
        {...props}
        onPointerDown={(event) => {
          if (useFastClose) setDragging(true);
          onPointerDown?.(event);
        }}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 flex-shrink-0 rounded-full bg-muted" />
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
