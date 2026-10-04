import { useState, type ReactNode } from "react";
import { ChevronsLeft } from "lucide-react";
import { CalculatorTutorial } from "./services/CalculatorTutorial";
import CalculatorSidebarFooter from "./services/CalculatorSidebarFooter";
import {
  CALCULATOR_MAIN_GRID,
  CALCULATOR_SIDEBAR_CARD,
} from "@/8-3-calculator/layout/calculatorLayout";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

const TUTORIAL_EXPANDED_KEY = "calculator-tutorial-expanded";

function readTutorialExpanded(): boolean {
  try {
    return sessionStorage.getItem(TUTORIAL_EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
}

interface TutorialSidebarProps {
  activeTab: "services" | "sales";
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export const TutorialSidebar = ({ activeTab, expanded, onExpandedChange }: TutorialSidebarProps) => {
  const { t } = useAppTranslation();

  if (!expanded) {
    return (
      <div className="flex w-11 shrink-0 self-stretch">
        <button
          type="button"
          className={cn(CALCULATOR_SIDEBAR_CARD, "w-full items-center justify-start gap-3 px-0 py-4 hover:bg-muted/40")}
          onClick={() => onExpandedChange(true)}
          aria-expanded={false}
          aria-label={t("pages.calculator.tutorial.expand", "Expand tutorial")}
        >
          <ChevronsLeft className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-medium text-foreground [writing-mode:vertical-rl]">
            {t("pages.calculator.tutorial.title", "Calculator Tutorial")}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
      <div className={CALCULATOR_SIDEBAR_CARD}>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CalculatorTutorial currentTab={activeTab} onCollapse={() => onExpandedChange(false)} />
        </div>
        <CalculatorSidebarFooter />
      </div>
    </div>
  );
};

export function CalculatorPageLayout({
  activeTab,
  children,
}: {
  activeTab: "services" | "sales";
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(readTutorialExpanded);

  const setExpandedPersisted = (next: boolean) => {
    setExpanded(next);
    try {
      sessionStorage.setItem(TUTORIAL_EXPANDED_KEY, next ? "1" : "0");
    } catch {
      /* ignore private-mode storage failures */
    }
  };

  return (
    <div
      className={
        expanded
          ? CALCULATOR_MAIN_GRID
          : "flex min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 items-stretch gap-2"
      }
    >
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden",
          expanded ? "col-span-9" : "min-w-0 flex-1",
        )}
      >
        {children}
      </div>
      <TutorialSidebar
        activeTab={activeTab}
        expanded={expanded}
        onExpandedChange={setExpandedPersisted}
      />
    </div>
  );
}
