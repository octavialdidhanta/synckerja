import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatPosActivityDateHeader,
} from "../lib/groupPosActivitiesByDate";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityDateGroup } from "../lib/posActivityTypes";

type Props = {
  group: PosActivityDateGroup;
};

export function PosActivityDateGroupHeader({ group }: Props) {
  const { t, language } = useAppTranslation();
  const locale = typeof language === "string" ? language : "id";

  let label: string;
  if (group.labelKind === "today") {
    label = t(POS_ACTIVITY_I18N.today, "TODAY");
  } else if (group.labelKind === "yesterday") {
    label = t(POS_ACTIVITY_I18N.yesterday, "YESTERDAY");
  } else {
    label = formatPosActivityDateHeader(group.dateIso, locale).toUpperCase();
  }

  return (
    <div className="sticky top-0 z-[1] bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
      {label}
    </div>
  );
}
