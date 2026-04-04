export type OkrPageTabId =
  | "company-objectives"
  | "department-objectives"
  | "individual-objectives";

export function getOkrActiveTabFromPath(pathname: string): OkrPageTabId {
  if (pathname.includes("/department-objective")) return "department-objectives";
  if (pathname.includes("/individual-objective")) return "individual-objectives";
  return "company-objectives";
}
