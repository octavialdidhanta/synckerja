import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { toast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { CreateOrganizationModal } from "./CreateOrganizationModal";
import { formatOrganizationRole } from "@/shared/lib/formatOrganizationRole";

/** Locks trigger min width to this label so the header does not jump when the active org name is shorter. */
const ORG_SWITCHER_WIDTH_SAMPLE = "PT Integrasi Visual Digital Indonesia";

export function OrganizationSwitcher() {
  const { t } = useTranslation();
  const { data, isLoading, setActiveOrganization, isSwitching } = useUserOrganizations();
  const [createOpen, setCreateOpen] = useState(false);

  const memberships = data?.memberships ?? [];
  const activeId = data?.activeOrganizationId ?? null;
  const active = memberships.find((m) => m.organizationId === activeId);
  const count = memberships.length;

  const handleSelect = async (organizationId: string) => {
    if (organizationId === activeId) return;
    try {
      await setActiveOrganization(organizationId);
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message === "not_member" ? "not_member" : "generic";
      toast({
        title: t("layout.orgSwitcher.switchErrorTitle"),
        description:
          msg === "not_member"
            ? t("layout.orgSwitcher.switchErrorNotMember")
            : t("layout.orgSwitcher.switchErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const triggerTitle = active?.companyName || t("layout.orgSwitcher.noOrganizations");
  const countLabel = t("layout.orgSwitcher.orgCount", { count });

  if (isLoading && !data) {
    return (
      <div
        className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
        aria-busy
        aria-label={t("layout.orgSwitcher.loading")}
      >
        <Skeleton className="h-4 w-4 shrink-0 rounded" />
        <div className="grid min-w-0 flex-1 shrink-0 grid-cols-1">
          <span
            className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm font-semibold"
            aria-hidden
          >
            {ORG_SWITCHER_WIDTH_SAMPLE}
          </span>
          <div className="col-start-1 row-start-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-[min(100%,12rem)] max-w-full" />
            <Skeleton className="h-3 w-[min(100%,8rem)] max-w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto max-w-full shrink-0 justify-start gap-2 border-border bg-background px-3 py-2 text-left font-normal hover:bg-brand-blue/10 hover:text-brand-blue"
            aria-label={t("layout.orgSwitcher.triggerAria")}
            aria-busy={isSwitching}
            disabled={isSwitching}
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-left">
              <div className="grid grid-cols-1">
                <span
                  className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm font-semibold"
                  aria-hidden
                >
                  {ORG_SWITCHER_WIDTH_SAMPLE}
                </span>
                <div className="col-start-1 row-start-1 min-w-0 max-w-full overflow-hidden">
                  <div className="truncate text-sm font-semibold text-foreground">{triggerTitle}</div>
                  <div className="truncate text-xs text-muted-foreground">{countLabel}</div>
                </div>
              </div>
            </div>
            {isSwitching ? (
              <Skeleton className="h-4 w-4 shrink-0 rounded" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-w-[min(100vw-2rem,28rem)] min-w-[var(--radix-dropdown-menu-trigger-width)] border-border bg-background"
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t("layout.orgSwitcher.sectionTitle", { count })}
          </DropdownMenuLabel>
          {memberships.map((m) => {
            const isActive = m.organizationId === activeId;
            const roleText = formatOrganizationRole(t, m.role);
            return (
              <DropdownMenuItem
                key={m.organizationId}
                className={cn(
                  "cursor-pointer gap-2 focus:bg-brand-blue/10 focus:text-brand-blue",
                  isActive && "bg-brand-blue/5",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleSelect(m.organizationId);
                }}
              >
                <div className="flex shrink-0 rounded-md bg-muted/80 p-1.5 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{m.companyName}</div>
                  <div className="truncate text-xs text-muted-foreground">{roleText}</div>
                </div>
                {isActive && <Check className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer gap-2 focus:bg-brand-blue/10 focus:text-brand-blue"
            onSelect={(e) => {
              e.preventDefault();
              setCreateOpen(true);
            }}
          >
            <div className="flex shrink-0 rounded-md bg-muted/80 p-1.5 text-brand-blue">
              <Plus className="h-4 w-4" />
            </div>
            <span className="font-medium">{t("layout.orgSwitcher.createNew")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
