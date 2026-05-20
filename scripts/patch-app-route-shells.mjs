import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/App.tsx");
let s = fs.readFileSync(appPath, "utf8");

const keepShells = new Set([
  "HomePageRouteLoadingShell",
  "HomePageSkeleton",
  "RecruitmentRouteSkeleton",
]);

s = s.replace(
  /import \{\s*HomePageSkeleton[\s\S]*?\} from "@\/appLazySkeletons";/,
  `import { HomePageSkeleton } from "@/1-home/skeletons/HomePageSkeleton";
import { HomePageRouteLoadingShell } from "@/shared/components/mobile/HomePageRouteLoadingShell";
import { StandardRouteLoadingShell } from "@/shared/components/StandardRouteLoadingShell";
import { RecruitmentRouteSkeleton } from "@/2-2-recruitment-dashboard/components/RecruitmentSkeletons";

const PAGE_GUARD_LOADING_SHELL = <StandardRouteLoadingShell />;`,
);

s = s.replace(/loadingShell=\{<([A-Za-z]+)\s*\/>\}/g, (match, name) => {
  if (keepShells.has(name)) return match;
  return "loadingShell={PAGE_GUARD_LOADING_SHELL}";
});

fs.writeFileSync(appPath, s, "utf8");
console.log("Patched App.tsx loading shells");
