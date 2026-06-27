import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";

type MobileTrafficWebIdPickerProps = {
  value: string;
  options: string[];
  loading?: boolean;
  disabled?: boolean;
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
  disabled = false,
  canDisconnect = false,
  disconnectingWebId = null,
  onValueChange,
  onConnectClick,
  onDisconnectClick,
}: MobileTrafficWebIdPickerProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const triggerLabel = useMemo(() => {
    if (loading) return t("common.loading", "Memuat…");
    if (options.length === 0) return "Connect web_id";
    const trimmed = value.trim();
    return trimmed || options[0] || "Connect web_id";
  }, [loading, options, t, value]);

  function handleSelect(webId: string) {
    onValueChange(webId);
    setOpen(false);
  }

  function handleConnect() {
    setOpen(false);
    onConnectClick();
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between gap-2 px-3"
          disabled={disabled || loading}
          aria-label={t("traffic.mobile.webId", "Web ID")}
        >
          <span className="truncate">{triggerLabel}</span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh] flex flex-col">
        <DrawerHeader className="text-left pb-2 safe-area-top">
          <DrawerTitle>{t("traffic.mobile.webId", "Web ID")}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-3">
          <div className="space-y-1">
            {options.length === 0 ? (
              <button
                type="button"
                onClick={handleConnect}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left"
              >
                <Plus className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="text-sm font-medium text-foreground">Connect web_id</span>
              </button>
            ) : (
              <>
                {options.map((id) => {
                  const active = value.trim() === id || (!value.trim() && id === options[0]);
                  const isDisconnecting = disconnectingWebId === id;
                  return (
                    <div key={id} className="flex min-w-0 items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelect(id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">{id}</span>
                        {active ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                      </button>
                      {canDisconnect ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 text-destructive disabled:opacity-50"
                          aria-label={`Disconnect web_id ${id}`}
                          disabled={isDisconnecting}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpen(false);
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
                <button
                  type="button"
                  onClick={handleConnect}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-muted-foreground"
                >
                  <Plus className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span className="text-sm font-medium">Connect web_id</span>
                </button>
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
