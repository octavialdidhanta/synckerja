import { CalculatorTutorial } from "./services/CalculatorTutorial";
import CalculatorSidebarFooter from "./services/CalculatorSidebarFooter";

interface TutorialSidebarProps {
  activeTab: "services" | "sales";
}

export const TutorialSidebar = ({ activeTab }: TutorialSidebarProps) => {
  return (
    <div className="col-span-12 flex h-full min-h-0 min-w-0 xl:col-span-3">
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CalculatorTutorial currentTab={activeTab} />
        </div>
        <CalculatorSidebarFooter />
      </div>
    </div>
  );
};
