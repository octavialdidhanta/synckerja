import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandData {
  id: string;
  reprimand_type: string;
  severity_level: string;
  violation_category: string;
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  violation_description: string;
  evidence_details?: string;
  witness_names?: string;
  previous_warnings_count: number;
  corrective_action_plan?: string;
  improvement_deadline?: string;
  follow_up_date?: string;
  status: string;
  acknowledgment_required: boolean;
  employee_acknowledged: boolean;
  acknowledgment_date?: string;
  is_formal: boolean;
  impact_on_performance_review: boolean;
  notes?: string;
  document_path?: string;
  issued_by: string;
  created_at: string;
  updated_at: string;
}

interface ReprimandViewDropdownProps {
  employeeId: string;
  employeeName: string;
  jobPosition?: string;
  profilePhotoUrl?: string;
  reprimandCount: number;
  reprimandBoxes: JSX.Element[];
  reprimands: ReprimandData[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "medium":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "low":
      return "border-brand-blue/30 bg-brand-blue/10 text-brand-blue";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-red-50 text-red-700 border-red-200";
    case "resolved":
      return "border-brand-blue/30 bg-brand-blue/10 text-brand-blue";
    case "appealed":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "cancelled":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

const formatReprimandType = (type: string) => {
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export const ReprimandViewDropdown = ({
  employeeName,
  jobPosition,
  profilePhotoUrl,
  reprimandCount,
  reprimandBoxes,
  reprimands,
}: ReprimandViewDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t, dateLocale } = useAppTranslation();

  const formatDate = (dateString: string | null | undefined) => {
    if (dateString == null || dateString === "") return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (reprimands.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />

            <div
              className="flex min-w-0 flex-shrink-0 items-center gap-2"
              style={{ minWidth: "150px", maxWidth: "180px" }}
            >
              <div className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full text-xs">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={employeeName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    employeeName.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-foreground">{employeeName}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {jobPosition || t("reprimands.dropdown.noPosition", "No position")}
                </p>
              </div>
            </div>

            <span className="flex-shrink-0 text-sm font-semibold text-foreground" style={{ minWidth: "32px" }}>
              {reprimandCount}x
            </span>

            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex w-max flex-shrink-0 gap-1 pr-4">{reprimandBoxes}</div>
            </div>

            <Button variant="outline" size="sm" className="h-8 flex-shrink-0 px-3 text-xs" disabled>
              {t("reprimands.dropdown.noViolations", "No Violations")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="cursor-pointer rounded-lg border border-border bg-muted/50 px-4 py-3 transition-colors hover:bg-brand-blue/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}

              <div
                className="flex min-w-0 flex-shrink-0 items-center gap-2"
                style={{ minWidth: "150px", maxWidth: "180px" }}
              >
                <div className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full text-xs">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={employeeName}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      employeeName.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">{employeeName}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {jobPosition || t("reprimands.dropdown.noPosition", "No position")}
                  </p>
                </div>
              </div>

              <span className="flex-shrink-0 text-sm font-semibold text-foreground" style={{ minWidth: "32px" }}>
                {reprimandCount}x
              </span>

              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex w-max flex-shrink-0 gap-1 pr-4">{reprimandBoxes}</div>
              </div>

              <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700">
                {t("reprimands.dropdown.violationsBadge", "{{count}} Violations", { count: reprimands.length })}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  reprimands.some((r) => r.status === "active")
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
                }`}
              >
                {reprimands.some((r) => r.status === "active")
                  ? t("reprimands.dropdown.active", "Active")
                  : t("reprimands.dropdown.resolved", "Resolved")}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="rounded-b-lg border-b border-l border-r border-border bg-card p-4">
          {reprimands.length === 0 ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h4 className="mb-2 font-medium text-foreground">
                {t("reprimands.dropdown.noViolationsTitle", "No violations for {{name}}", { name: employeeName })}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t(
                  "reprimands.dropdown.noViolationsDesc",
                  "This employee has a clean record with no disciplinary actions.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reprimands.filter((r) => r.status === "active").length > 0 && (
                <div>
                  <div className="mb-2 flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-foreground">
                      {t("reprimands.dropdown.activeViolations", "Active Violations")}
                    </span>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700">
                      {reprimands.filter((r) => r.status === "active").length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {reprimands
                      .filter((r) => r.status === "active")
                      .map((reprimand, index) => (
                        <div key={reprimand.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                              <Badge className={`text-xs ${getSeverityColor(reprimand.severity_level)}`}>
                                {reprimand.severity_level}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(reprimand.incident_date)}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="mb-1 text-sm font-medium text-foreground">
                              {formatReprimandType(reprimand.reprimand_type)}
                            </h4>
                            <p className="mb-2 text-xs text-muted-foreground">{reprimand.violation_description}</p>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.category", "Category:")}
                              </span>
                              <span className="font-medium">{reprimand.violation_category}</span>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.previous", "Previous:")}
                              </span>
                              <span className="font-medium">{reprimand.previous_warnings_count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {reprimands.filter((r) => r.status === "resolved").length > 0 && (
                <div>
                  <div className="mb-2 flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-brand-blue" />
                    <span className="text-sm font-medium text-foreground">
                      {t("reprimands.dropdown.resolvedViolations", "Resolved Violations")}
                    </span>
                    <Badge variant="outline" className="border-brand-blue/30 bg-brand-blue/10 text-xs text-brand-blue">
                      {reprimands.filter((r) => r.status === "resolved").length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {reprimands
                      .filter((r) => r.status === "resolved")
                      .map((reprimand, index) => (
                        <div key={reprimand.id} className="rounded-lg border border-brand-blue/25 bg-brand-blue/10 p-3">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                              <Badge className={`text-xs ${getSeverityColor(reprimand.severity_level)}`}>
                                {reprimand.severity_level}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(reprimand.incident_date)}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="mb-1 text-sm font-medium text-foreground">
                              {formatReprimandType(reprimand.reprimand_type)}
                            </h4>
                            <p className="mb-2 text-xs text-muted-foreground">{reprimand.violation_description}</p>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.category", "Category:")}
                              </span>
                              <span className="font-medium">{reprimand.violation_category}</span>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.previous", "Previous:")}
                              </span>
                              <span className="font-medium">{reprimand.previous_warnings_count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {reprimands.filter((r) => !["active", "resolved"].includes(r.status)).length > 0 && (
                <div>
                  <div className="mb-2 flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-foreground">
                      {t("reprimands.dropdown.otherStatus", "Other Status")}
                    </span>
                    <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700">
                      {reprimands.filter((r) => !["active", "resolved"].includes(r.status)).length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {reprimands
                      .filter((r) => !["active", "resolved"].includes(r.status))
                      .map((reprimand, index) => (
                        <div key={reprimand.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                              <Badge className={`text-xs ${getSeverityColor(reprimand.severity_level)}`}>
                                {reprimand.severity_level}
                              </Badge>
                              <Badge className={`text-xs ${getStatusColor(reprimand.status)}`}>
                                {reprimand.status}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(reprimand.incident_date)}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="mb-1 text-sm font-medium text-foreground">
                              {formatReprimandType(reprimand.reprimand_type)}
                            </h4>
                            <p className="mb-2 text-xs text-muted-foreground">{reprimand.violation_description}</p>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.category", "Category:")}
                              </span>
                              <span className="font-medium">{reprimand.violation_category}</span>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-muted-foreground">
                                {t("reprimands.dropdown.previous", "Previous:")}
                              </span>
                              <span className="font-medium">{reprimand.previous_warnings_count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ReprimandViewDropdown;
