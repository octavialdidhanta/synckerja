import { useToast } from "@/shared/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/shared/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {props.variant === "headsUp" ? (
              <div className="min-w-0 truncate text-[11px] font-medium leading-5 text-foreground/90">
                {[title, description].filter(Boolean).join(" — ")}
              </div>
            ) : (
              <div className="grid gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            )}
            {action}
            {props.variant === "headsUp" ? null : <ToastClose />}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
