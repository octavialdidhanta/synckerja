import { OrganizationSwitcher } from "@/shared/layouts/header/OrganizationSwitcher";
import { HeaderNotificationsButton } from "@/shared/layouts/header/HeaderNotificationsButton";
import { UserProfileDropdown } from "@/shared/layouts/header/user-profile";

export function AppHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-neutral-200 bg-[#ffffff] shadow-sm dark:border-neutral-600 dark:bg-background">
      <div className="flex h-16 w-full items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="-ml-2 shrink-0">
            <OrganizationSwitcher />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <HeaderNotificationsButton />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
