import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import {
  flowBuilderAvatarColorClass,
  flowBuilderUserInitials,
} from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/flowBuilderUserUtils";
import { FlowBuilderPillFilterTrigger } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderPillFilterTrigger";
import type { FlowBuilderUserOption } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderUserFilterProps = {
  labelKey: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  users: FlowBuilderUserOption[];
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function FlowBuilderUserFilter({ labelKey, value, onChange, users }: FlowBuilderUserFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedUser = users.find((user) => user.id === value) ?? null;

  const triggerLabel = selectedUser
    ? `${t(labelKey)}: ${selectedUser.fullName}`
    : t(labelKey);

  const filteredUsers = useMemo(() => {
    const q = normalizeQuery(search);
    if (!q) return users;
    return users.filter((user) => {
      const haystack = `${user.fullName} ${user.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, users]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <FlowBuilderPillFilterTrigger
          label={triggerLabel}
          open={open}
          className="max-w-[12rem]"
          aria-label={triggerLabel}
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("omnichannel.settings.flowBuilder.filters.searchUsers")}
            className="h-9 pl-9"
            autoFocus
          />
        </div>
        <div className="scrollbar-hide max-h-56 space-y-0.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {value ? (
            <button
              type="button"
              className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {t("omnichannel.settings.flowBuilder.filters.clearUser")}
            </button>
          ) : null}
          {filteredUsers.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("omnichannel.settings.flowBuilder.filters.noUsers")}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const initials = flowBuilderUserInitials(user.fullName);
              const colorClass = flowBuilderAvatarColorClass(user.fullName || user.email);
              const selected = value === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60",
                    selected && "bg-primary/5",
                  )}
                  onClick={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                      colorClass,
                    )}
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{user.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
