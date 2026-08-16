import { useEffect, useRef, useState } from "react";
import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";

type MobileTrafficWebIdPickerProps = {
  value: string;
  options: string[];
  loading?: boolean;
  canDisconnect?: boolean;
  disconnectingWebId?: string | null;
  onValueChange: (value: string) => void;
  onConnectClick: () => void;
  onDisconnectClick: (webId: string) => void;
};

export function MobileTrafficWebIdPicker({
  value,
  options,
  loading = false,
  canDisconnect = false,
  disconnectingWebId = null,
  onValueChange,
  onConnectClick,
  onDisconnectClick,
}: MobileTrafficWebIdPickerProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const pendingWebIdRef = useRef<string | null>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = options.find((id) => id === value) ?? options[0];

  useEffect(() => {
    return () => {
      if (applyTimerRef.current != null) {
        clearTimeout(applyTimerRef.current);
      }
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) return;
    const nextId = pendingWebIdRef.current;
    pendingWebIdRef.current = null;
    if (!nextId || nextId === value) return;
    if (applyTimerRef.current != null) {
      clearTimeout(applyTimerRef.current);
    }
    applyTimerRef.current = setTimeout(() => {
      applyTimerRef.current = null;
      onValueChange(nextId);
    }, 450);
  };

  if (loading || (options.length <= 1 && !canDisconnect)) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={
          selected
            ? t("traffic.mobile.switchWebIdNamed", "Switch web ID: {{name}}", {
                name: selected,
              })
            : t("traffic.mobile.webId", "Web ID")
        }
        onClick={() => setOpen(true)}
      >
        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Button>

      <Drawer shouldScaleBackground={false} modal open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[85vh] px-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("traffic.mobile.webId", "Web ID")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {options.length === 0 ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted/60"
                onClick={() => {
                  handleOpenChange(false);
                  onConnectClick();
                }}
              >
                <Plus className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span>Connect web_id</span>
              </button>
            ) : (
              <>
                {options.map((id) => {
                  const isActive = id === value || (!value.trim() && id === options[0]);
                  const isDisconnecting = disconnectingWebId === id;
                  return (
                    <div key={id} className="flex min-w-0 items-stretch gap-1">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-start rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted/60",
                        )}
                        onClick={() => {
                          if (id !== value) pendingWebIdRef.current = id;
                          handleOpenChange(false);
                        }}
                      >
                        <span className="truncate">{id}</span>
                      </button>
                      {canDisconnect ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center justify-center rounded-md px-3 text-destructive disabled:opacity-50"
                          aria-label={`Disconnect web_id ${id}`}
                          disabled={isDisconnecting}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenChange(false);
                            onDisconnectClick(id);
                          }}
                        >
                          {isDisconnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {canDisconnect ? (
                  <button
                    type="button"
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/60"
                    onClick={() => {
                      handleOpenChange(false);
                      onConnectClick();
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    <span>Connect web_id</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

MobileTrafficWebIdPicker.displayName = "MobileTrafficWebIdPicker";
