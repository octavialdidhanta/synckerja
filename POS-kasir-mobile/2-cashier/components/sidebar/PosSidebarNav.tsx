import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosSidebarNavItem } from "./PosSidebarNavItem";
import {
  type PosSidebarItem,
  type PosSidebarItemId,
} from "./posSidebarItems";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";

type Props = {
  activeId: PosSidebarItemId;
  badges?: Partial<Record<PosSidebarItemId, number>>;
  onSelect: (item: PosSidebarItem) => void;
};

export function PosSidebarNav({ activeId, badges, onSelect }: Props) {
  const { t } = useAppTranslation();
  const { sidebarItems } = usePosAppPermissions();

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1" aria-label="POS">
      {sidebarItems.map((item) => (
        <PosSidebarNavItem
          key={item.id}
          icon={item.icon}
          label={t(item.labelKey, item.labelFallback)}
          active={item.id === activeId}
          badge={badges?.[item.id]}
          onClick={() => onSelect(item)}
        />
      ))}
    </nav>
  );
}
