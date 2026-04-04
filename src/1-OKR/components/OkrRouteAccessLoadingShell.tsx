import { useLocation } from "react-router-dom";
import { CompanyObjectivePageSkeleton } from "./CompanyObjectivePageSkeleton";
import { DepartmentObjectivePageSkeleton } from "./DepartmentObjectivePageSkeleton";
import { IndividualObjectivePageSkeleton } from "./IndividualObjectivePageSkeleton";
import { getOkrActiveTabFromPath } from "../utils/okrPaths";

/** Guard / Suspense-style shell: same layout as destination OKR tab to avoid hard-refresh layout jump. */
export function OkrRouteAccessLoadingShell() {
  const { pathname } = useLocation();
  const tab = getOkrActiveTabFromPath(pathname);
  if (tab === "department-objectives") {
    return <DepartmentObjectivePageSkeleton />;
  }
  if (tab === "individual-objectives") {
    return <IndividualObjectivePageSkeleton />;
  }
  return <CompanyObjectivePageSkeleton />;
}
