import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Crown, LogOut, Settings } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatOrganizationRole } from "@/shared/lib/formatOrganizationRole";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useHeaderUserProfile } from "@/shared/hooks/useHeaderUserProfile";
import { cn } from "@/shared/lib/utils";
import { UserAvatarBadge } from "./UserAvatarBadge";

export function UserProfileDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { displayName, email, initials, avatarImageUrl, role, isLoading } = useHeaderUserProfile();

  const roleLabel = formatOrganizationRole(t, role);
  const isOwner = role.toLowerCase() === "owner";
  const showCrown = isOwner;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const onTransferOwnership = () => {
    navigate("/transfer-ownership");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto max-w-[min(100vw-12rem,17rem)] gap-3 rounded-xl px-2 py-1.5 text-left",
            "hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={t("layout.header.openMenu")}
          disabled={isLoading}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {showCrown && <Crown className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />}
              <span className="truncate">{roleLabel}</span>
            </div>
          </div>
          <UserAvatarBadge initials={initials} imageUrl={avatarImageUrl} size="md" />
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="z-[100] w-72 overflow-hidden rounded-xl border-border p-0 shadow-lg">
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="flex gap-3">
            <UserAvatarBadge initials={initials} imageUrl={avatarImageUrl} size="lg" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{email || "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground">
            {showCrown && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />}
            <span className="min-w-0 truncate">{roleLabel}</span>
          </div>
        </div>
        <div className="p-1.5">
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2.5 text-sm focus:bg-brand-blue/10 focus:text-brand-blue">
            <Link to="/settings" className="flex items-center gap-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              {t("layout.header.settings")}
            </Link>
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem
              className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-amber-800 focus:bg-amber-500/10 focus:text-amber-900 dark:text-amber-400 dark:focus:text-amber-300"
              onClick={onTransferOwnership}
            >
              <Crown className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
              {t("layout.userMenu.transferOwnership")}
            </DropdownMenuItem>
          )}
        </div>
        <DropdownMenuSeparator className="my-0 bg-border" />
        <div className="p-1.5">
          <DropdownMenuItem
            className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {t("layout.header.signOut")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
