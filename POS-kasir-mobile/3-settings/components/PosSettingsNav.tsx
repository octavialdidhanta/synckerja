import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosSettingsNavItem } from "./PosSettingsNavItem";
import {
  POS_SETTINGS_NAV,
  type PosSettingsNavItem as NavModel,
  type PosSettingsSectionId,
} from "../lib/posSettingsSections";

type Props = {
  activeId: PosSettingsSectionId;
  onSelect: (id: PosSettingsSectionId) => void;
  /** Override nav status labels (e.g. tax Aktif from tax_enabled). `null` hides status. */
  statusOverrides?: Partial<Record<PosSettingsSectionId, string | null>>;
};

type NavGroup = {
  sectionKey: string;
  sectionFallback: string;
  items: NavModel[];
};

function groupNav(items: readonly NavModel[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.sectionKey === item.sectionKey) {
      last.items.push(item);
    } else {
      groups.push({
        sectionKey: item.sectionKey,
        sectionFallback: item.sectionFallback,
        items: [item],
      });
    }
  }
  return groups;
}

export function PosSettingsNav({ activeId, onSelect, statusOverrides }: Props) {
  const { t } = useAppTranslation();
  const grouped = groupNav(POS_SETTINGS_NAV);

  return (
    <nav className="flex flex-col" aria-label="Settings">
      {grouped.map((group) => (
        <div key={group.sectionKey} className="border-b border-slate-200">
          <p className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-900">
            {t(group.sectionKey, group.sectionFallback)}
          </p>
          {group.items.map((item) => {
            const override = statusOverrides?.[item.id];
            let statusLabel: string | undefined;
            if (override === null) {
              statusLabel = undefined;
            } else if (typeof override === "string") {
              statusLabel = override;
            } else if (item.statusKey) {
              statusLabel = t(item.statusKey, item.statusFallback ?? "Active");
            }

            return (
              <PosSettingsNavItem
                key={item.id}
                label={t(item.labelKey, item.labelFallback)}
                statusLabel={statusLabel}
                active={item.id === activeId}
                onClick={() => onSelect(item.id)}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}
