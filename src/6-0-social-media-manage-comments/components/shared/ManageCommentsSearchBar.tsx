import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";

type ManageCommentsSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ManageCommentsSearchBar({ value, onChange }: ManageCommentsSearchBarProps) {
  const { t } = useTranslation();
  return (
    <div className="relative px-3 pt-3">
      <Search
        className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(
          "digitalMarketing.manageComments.searchPlaceholder",
          "Search",
        )}
        className="h-9 rounded-lg pl-9"
        aria-label={t(
          "digitalMarketing.manageComments.searchPlaceholder",
          "Search",
        )}
      />
    </div>
  );
}

ManageCommentsSearchBar.displayName = "ManageCommentsSearchBar";
