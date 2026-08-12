import { useState } from "react";
import { Check, Filter } from "lucide-react";
import { SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";
import { cn } from "@/shared/lib/utils";

type Service = {
  id: string;
  name: string;
};

type Props = {
  services?: Service[];
  selectedService?: string;
  onServiceChange?: (serviceId: string) => void;
  showServiceFilter?: boolean;
};

export function ContentCalendarMobileShellHeader({
  services = [],
  selectedService = "all",
  onServiceChange,
  showServiceFilter = false,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const handleSelect = (serviceId: string) => {
    onServiceChange?.(serviceId);
    setOpen(false);
  };

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-h-9 min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="md:hidden h-9 w-9 shrink-0 self-center" />
          <h1 className="min-w-0 truncate text-base font-semibold leading-none text-foreground">
            {t("sidebar.digitalMarketing.socialMedia.title", "Social Media Management")}
          </h1>
        </div>

        {showServiceFilter ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0",
                selectedService !== "all" && "text-primary",
              )}
              aria-label={t("contentCalendar.filter.service", "Service")}
              onClick={() => setOpen(true)}
            >
              <Filter className="h-4 w-4" aria-hidden />
            </Button>

            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerContent className="max-h-[85vh] px-0 pb-4">
                <DrawerHeader className="px-4 pb-2 text-left">
                  <DrawerTitle className="text-base">
                    {t("contentCalendar.filter.service", "Service")}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => handleSelect("all")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                      selectedService === "all"
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {t("contentCalendar.filter.allServices", "All Services")}
                    </span>
                    {selectedService === "all" ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                  {services.map((service) => {
                    const active = selectedService === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleSelect(service.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{service.name}</span>
                        {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          <div className="h-9 w-9 shrink-0" aria-hidden />
        )}
      </header>
      <SubscriptionExpiryBannerSlot />
    </>
  );
}
