import { CalculatorTutorial } from "./services/CalculatorTutorial";
import CalculatorSidebarFooter from "./services/CalculatorSidebarFooter";

import { CALCULATOR_SIDEBAR_CARD } from "@/8-3-calculator/layout/calculatorLayout";

interface TutorialSidebarProps {
  activeTab: "services" | "sales";
}

export const TutorialSidebar = ({ activeTab }: TutorialSidebarProps) => {
  return (
    <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
      <div className={CALCULATOR_SIDEBAR_CARD}>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CalculatorTutorial currentTab={activeTab} />
        </div>
        <CalculatorSidebarFooter />
      </div>
    </div>
  );
};
