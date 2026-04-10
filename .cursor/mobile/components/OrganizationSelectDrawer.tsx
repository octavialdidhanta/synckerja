import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile/components/ui/drawer";
import { useOrganizationList } from "@/mobile/hooks/useOrganizationList";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

export interface OrganizationSelectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitched?: (organizationId: string) => void;
}

export function OrganizationSelectDrawer({
  open,
  onOpenChange,
  onSwitched,
}: OrganizationSelectDrawerProps) {
  const { t } = useAppTranslation();
  const {
    organizations,
    activeOrganizationId,
    loading,
    switchingOrganization,
    switchOrganization,
  } = useOrganizationList();

  const handleSelect = async (organizationId: string) => {
    if (activeOrganizationId === organizationId) {
      onOpenChange(false);
      return;
    }
    await switchOrganization(organizationId, (id) => {
      onOpenChange(false);
      onSwitched?.(id);
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b border-border text-left safe-area-top px-4 pt-4 pb-3">
          <DrawerTitle className="text-lg font-semibold text-foreground">
            {t("profile.selectOrganization", "Pilih Organisasi")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 pb-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">
              {t("profile.loading", "Memuat...")}
            </p>
          ) : (
            <ul className="space-y-1">
              {organizations.map((org) => {
                const isActive = org.id === activeOrganizationId;
                return (
                  <li key={org.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(org.id)}
                      disabled={switchingOrganization}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className="truncate">{org.company_name}</span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
