import { FileText } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MEETING_NOTES_ROUTE = "/tools/meeting-notes";

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const isActive = activeTab === "meeting-notes";

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">Meeting Notes</h1>
        <p className="text-xs text-gray-600">Track and manage meeting discussions and action items</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={MEETING_NOTES_ROUTE}
            label="Meeting Notes"
            icon={FileText}
            isActive={isActive}
            onActivate={() => onTabChange("meeting-notes")}
            activeClassName="border-blue-500 text-blue-600"
            inactiveClassName="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          />
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
