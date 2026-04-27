import React, { useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";

export function WebIdPicker({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  const { t } = useAppTranslation();
  const isMobileViewport = useIsMobile();
  const [open, setOpen] = useState(false);
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-synckerja-android-native") === "true");
  const useDrawer = isNative || isMobileViewport;

  const label = useMemo(() => {
    const v = value.trim();
    return v ? v : t("traffic.mobile.webId.auto", "Auto");
  }, [t, value]);

  if (!useDrawer) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">{t("traffic.mobile.webId.auto", "Auto")}</option>
        {options.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between gap-2 px-3"
          disabled={disabled}
          aria-label={t("traffic.mobile.webId", "Web ID")}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh] flex flex-col">
        <DrawerHeader className="text-left pb-2 safe-area-top">
          <DrawerTitle>{t("traffic.mobile.webId", "Web ID")}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-3">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {t("traffic.mobile.webId.auto", "Auto")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("traffic.mobile.webId.auto.desc", "Pakai web id pertama yang bisa diakses")}
                  </div>
                </div>
                {value.trim() === "" ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </div>
            </button>

            {options.map((id) => {
              const active = value.trim() === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-medium text-foreground">{id}</div>
                    {active ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

