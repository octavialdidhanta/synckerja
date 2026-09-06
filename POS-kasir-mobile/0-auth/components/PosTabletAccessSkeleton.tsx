import { PosAuthSurfaceLoading } from "../layout/PosAuthSurfaceLoading";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_TABLET_ACCESS_I18N } from "../lib/posTabletAccessCopy";

/**
 * While tablet access resolves, avoid a second full auth viewport when already
 * inside the funnel shell (select-outlet). Outside the shell, use the full fallback.
 */
export function PosTabletAccessSkeleton() {
  const { t } = useAppTranslation();
  const label = t(POS_TABLET_ACCESS_I18N.loadingLabel, "Checking POS access");

  return <PosAuthSurfaceLoading label={label} />;
}
