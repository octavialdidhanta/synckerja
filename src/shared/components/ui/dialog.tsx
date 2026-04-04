import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    aria-label="Dialog backdrop"
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-dialog-overlay-in data-[state=closed]:animate-dialog-overlay-out",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** When true, the built-in close (X) control is not rendered (e.g. mobile full-screen or non-dismissible flows). */
  hideCloseButton?: boolean;
  /** Merged into `DialogOverlay` so it is not forwarded to the content DOM node. */
  overlayClassName?: string;
  /** Full-viewport shells: use slide/scale animation without centered translate (see `synckerja-reference` dialog). */
  fullscreenAnimation?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      hideCloseButton = false,
      overlayClassName,
      fullscreenAnimation = false,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
          ref={ref}
          data-fullscreen-animation={fullscreenAnimation ? "true" : undefined}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            fullscreenAnimation
              ? "data-[state=open]:animate-dialog-content-in-fs data-[state=closed]:animate-dialog-content-out-fs"
              : "data-[state=open]:animate-dialog-content-in data-[state=closed]:animate-dialog-content-out",
            className,
          )}
          {...props}
        >
          {children}
          {!hideCloseButton ? (
            <DialogPrimitive.Close
              className={cn(
                "absolute right-3 top-3 z-[60] flex h-9 w-9 items-center justify-center rounded-md",
                "opacity-80 ring-offset-background transition-opacity hover:opacity-100",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:pointer-events-none data-[state=open]:bg-accent/80 data-[state=open]:text-muted-foreground",
                "sm:right-5 sm:top-5",
              )}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">{t("layout.sheetClose")}</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
