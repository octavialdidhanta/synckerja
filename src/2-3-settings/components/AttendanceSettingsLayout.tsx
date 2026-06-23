
import { useState, type ElementType } from "react";
import {
  MapPin,
  Calendar,
  ClipboardList,
  DollarSign,
  UserCog,
  Building,
  Wifi,
} from "lucide-react";
import { OptimizedOfficeLocationsList } from "./OptimizedOfficeLocationsList";
import { ClientManagement } from "./ClientManagement";
import { VisitScheduling } from "./VisitScheduling";
import { WorkScheduleSettings } from "./WorkScheduleSettings";
import { AttendanceRulesSettings } from "./AttendanceRulesSettings";
import { ComprehensivePenaltySettings } from "./ComprehensivePenaltySettings";
import { ShiftSettings } from "./ShiftSettings";
import { IPAddressSettings } from "./IPAddressSettings";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  ATTENDANCE_SETTINGS_CARD_FOOTER,
  ATTENDANCE_SETTINGS_CARD_HEADER,
  ATTENDANCE_SETTINGS_GRID,
  ATTENDANCE_SETTINGS_MAIN_COLUMN,
  ATTENDANCE_SETTINGS_NAV_COLUMN,
  ATTENDANCE_SETTINGS_SCROLL_PANE,
} from "@/2-3-attendance/layout/attendanceSettingsLayout";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: ElementType;
  status?: "active" | "inactive" | "warning";
  component?: React.ReactNode;
}

interface AttendanceSettingsLayoutProps {
  children?: React.ReactNode;
}

const SETTINGS_CARD_TITLE_CLASS =
  "m-0 truncate text-sm font-semibold leading-tight text-foreground";
const SETTINGS_CARD_SUBTITLE_CLASS = "mb-0 mt-1 text-xs leading-snug text-muted-foreground";

export const AttendanceSettingsLayout = ({ children }: AttendanceSettingsLayoutProps) => {
  const { t } = useAppTranslation();
  const [activeSection, setActiveSection] = useState("work-schedule");

  const settingsSections: SettingsSection[] = [
    {
      id: "work-schedule",
      title: t("attendanceSettings.workSchedule.title", "Work Schedule"),
      description: t(
        "attendanceSettings.workSchedule.description",
        "Configure working days, working hours, and holidays",
      ),
      icon: Calendar,
      status: "active",
      component: <WorkScheduleSettings />,
    },
    {
      id: "shift-settings",
      title: t("attendanceSettings.shiftSettings.title", "Shift Settings"),
      description: t(
        "attendanceSettings.shiftSettings.description",
        "Manage work shifts and employee assignments",
      ),
      icon: UserCog,
      status: "active",
      component: <ShiftSettings />,
    },
    {
      id: "attendance-rules",
      title: t("attendanceSettings.attendanceRules.title", "Attendance Rules"),
      description: t(
        "attendanceSettings.attendanceRules.description",
        "Configure validation and attendance requirements",
      ),
      icon: ClipboardList,
      status: "active",
      component: <AttendanceRulesSettings />,
    },
    {
      id: "penalty-settings",
      title: t("attendanceSettings.penaltySettings.title", "Penalty Settings"),
      description: t(
        "attendanceSettings.penaltySettings.description",
        "Complete configuration of late penalty system",
      ),
      icon: DollarSign,
      status: "active",
      component: <ComprehensivePenaltySettings />,
    },
    {
      id: "office-locations",
      title: t("attendanceSettings.officeLocations.title", "Office Locations"),
      description: t(
        "attendanceSettings.officeLocations.description",
        "Manage office locations with interactive map",
      ),
      icon: MapPin,
      status: "active",
      component: <OptimizedOfficeLocationsList />,
    },
    {
      id: "client-management",
      title: t("attendanceSettings.clientManagement.title", "Client Management"),
      description: t(
        "attendanceSettings.clientManagement.description",
        "Manage clients and their locations",
      ),
      icon: Building,
      status: "active",
      component: <ClientManagement />,
    },
    {
      id: "visit-scheduling",
      title: t("attendanceSettings.visitScheduling.title", "Visit Scheduling"),
      description: t(
        "attendanceSettings.visitScheduling.description",
        "Schedule and track employee visits",
      ),
      icon: Calendar,
      status: "active",
      component: <VisitScheduling />,
    },
    {
      id: "ip-address-settings",
      title: t("attendanceSettings.ipAddressSettings.title", "IP Address Settings"),
      description: t(
        "attendanceSettings.ipAddressSettings.description",
        "Manage list of allowed IP addresses for attendance",
      ),
      icon: Wifi,
      status: "active",
      component: <IPAddressSettings />,
    },
  ];

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "active":
        return t("attendanceSettings.status.active", "active");
      case "warning":
        return t("attendanceSettings.status.warning", "warning");
      case "inactive":
        return t("attendanceSettings.status.inactive", "inactive");
      default:
        return status || "";
    }
  };

  const getCurrentSection = () => settingsSections.find((s) => s.id === activeSection);

  const renderSectionContent = () => {
    const currentSection = getCurrentSection();
    if (currentSection?.component) return currentSection.component;
    return (
      children || (
        <div className="py-8 text-center text-muted-foreground">
          {t("attendanceSettings.comingSoon", "Settings content will be implemented soon")}
        </div>
      )
    );
  };

  const current = getCurrentSection();

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <div className={ATTENDANCE_SETTINGS_GRID}>
        <div className={ATTENDANCE_SETTINGS_NAV_COLUMN}>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:h-full">
              <div className={ATTENDANCE_SETTINGS_CARD_HEADER}>
                <h3 className={SETTINGS_CARD_TITLE_CLASS}>
                  {t("attendanceSettings.sidebarCardTitle", "Attendance settings")}
                </h3>
                <p className={SETTINGS_CARD_SUBTITLE_CLASS}>
                  {t(
                    "attendanceSettings.sidebarCardSubtitle",
                    "Configure attendance, locations, and rules",
                  )}
                </p>
              </div>

              <div className={cn(ATTENDANCE_SETTINGS_SCROLL_PANE, "p-3")}>
                <div className="space-y-2">
                  {settingsSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "group w-full rounded-md p-3 text-left transition-all duration-200 ease-out",
                          isActive
                            ? "border-2 border-primary/50 bg-accent shadow-sm"
                            : "border border-border bg-card hover:border-primary/30 hover:bg-muted/60",
                        )}
                      >
                        <div className="flex items-start space-x-3">
                          <div
                            className={cn(
                              "flex-shrink-0 rounded-md p-2 transition-colors duration-200",
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between gap-1">
                              <h3 className="truncate text-sm font-medium text-foreground">
                                {section.title}
                              </h3>
                              {section.status && (
                                <span
                                  className={cn(
                                    "ml-1 inline-flex flex-shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium",
                                    section.status === "active"
                                      ? "bg-success-muted text-success-foreground"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {getStatusLabel(section.status)}
                                </span>
                              )}
                            </div>
                            <p
                              className={cn(
                                "text-xs leading-tight",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground/80",
                              )}
                            >
                              {section.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={ATTENDANCE_SETTINGS_CARD_FOOTER}>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("attendanceSettings.footer.overview", "Settings overview")}</span>
                  <span className="text-xs text-muted-foreground/80">
                    Total: {settingsSections.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={ATTENDANCE_SETTINGS_MAIN_COLUMN}>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:h-full">
              <div className={ATTENDANCE_SETTINGS_CARD_HEADER}>
                <div className="min-w-0 flex-1">
                  <h3 className={SETTINGS_CARD_TITLE_CLASS}>
                    {current?.title ?? t("attendanceSettings.title", "Attendance Settings")}
                  </h3>
                  <p className={SETTINGS_CARD_SUBTITLE_CLASS}>
                    {current?.description ??
                      t(
                        "attendanceSettings.description",
                        "Configure location-based attendance system",
                      )}
                  </p>
                </div>
              </div>

              <div className={ATTENDANCE_SETTINGS_SCROLL_PANE}>
                <div className="min-w-0 p-4">{renderSectionContent()}</div>
              </div>

              <div className={ATTENDANCE_SETTINGS_CARD_FOOTER}>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("attendanceSettings.footer.sections", "Sections")}:{" "}
                    <span className="font-medium text-foreground">{settingsSections.length}</span>
                  </span>
                  <span className="text-xs text-muted-foreground/80">
                    {t("attendanceSettings.footer.statusLabel", "Status")}:{" "}
                    <span className="font-medium text-primary">
                      {t("attendanceSettings.footer.statusActive", "Active")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
