import { useState, type ReactNode } from "react";
import { Info, Shield, Wifi } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { PillarData } from "@/6-1-dashboard/types/social-media";
import {
  FUNNEL_CONFIG,
  computeFunnelStats,
  filterPillarsByFunnel,
  pillarBarWidth,
  type FunnelStage,
} from "@/6-1-dashboard/lib/contentPillarTracker";

const TRACKER_INFO_DESCRIPTION =
  "Tracks how many content pieces use each content pillar in the selected month, grouped by marketing funnel stage: Awareness (top), Consideration (middle), and Conversion (bottom).";

function InfoDescriptionPopover({
  title,
  description,
  ariaLabel,
  showTitle = true,
  open,
  onOpenChange,
}: {
  title: string;
  description: string;
  ariaLabel?: string;
  showTitle?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <button
        type="button"
        data-pillar-info=""
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        aria-label={ariaLabel ?? title}
        aria-expanded={open}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <Info className="h-3 w-3" />
      </button>
      {open ? (
        <div
          data-pillar-info=""
          role="tooltip"
          className="basis-full rounded-md border bg-popover p-3 text-left shadow-sm"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {showTitle ? (
            <p className="mb-1 text-sm font-medium text-gray-900">{title}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm text-gray-600">{description}</p>
        </div>
      ) : null}
    </>
  );
}

function PillarTrackerRow({
  pillar,
  selectedConfig,
  noDescriptionText,
  infoAriaLabel,
  isSelected,
  infoOpen,
  onInfoOpenChange,
  onSelectPillar,
}: {
  pillar: PillarData;
  selectedConfig: (typeof FUNNEL_CONFIG)[FunnelStage];
  noDescriptionText: string;
  infoAriaLabel: string;
  isSelected: boolean;
  infoOpen: boolean;
  onInfoOpenChange: (open: boolean) => void;
  onSelectPillar?: (pillarId: string) => void;
}) {

  return (
    <div
      role={onSelectPillar ? "button" : undefined}
      tabIndex={onSelectPillar ? 0 : undefined}
      className={cn(
        "w-full space-y-1 text-left",
        onSelectPillar && "cursor-pointer rounded-md px-1 py-1 -mx-1",
        onSelectPillar && isSelected && "bg-primary/10",
      )}
      onClick={
        onSelectPillar
          ? (event) => {
              if ((event.target as HTMLElement).closest("[data-pillar-info]")) return;
              onSelectPillar(pillar.pillar_id);
            }
          : undefined
      }
      onKeyDown={
        onSelectPillar
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectPillar(pillar.pillar_id);
              }
            }
          : undefined
      }
    >
      <span className="block text-sm font-medium text-gray-900">{pillar.pillar_name}</span>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {pillar.category?.trim() ? (
            <span className="min-w-0 truncate text-[10px] uppercase leading-tight text-gray-500">
              {pillar.category.trim()}
            </span>
          ) : null}
          <InfoDescriptionPopover
            title={pillar.pillar_name}
            description={pillar.description?.trim() || noDescriptionText}
            ariaLabel={infoAriaLabel}
            showTitle={false}
            open={infoOpen}
            onOpenChange={onInfoOpenChange}
          />
        </div>
        {infoOpen ? null : (
          <div className="flex shrink-0 items-end gap-2 leading-none">
            {pillar.isDefault ? (
              <div className="flex items-center">
                <Shield className="h-3 w-3 text-blue-500" />
                <span className="ml-1 text-xs leading-tight text-blue-600">Default</span>
              </div>
            ) : null}
            <span className="text-sm font-medium text-gray-900">{pillar.count}</span>
            <span>{selectedConfig.emoji}</span>
          </div>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pillarBarWidth(pillar.count)}%`,
            backgroundColor: selectedConfig.color,
          }}
        />
      </div>
    </div>
  );
}

export type ContentPillarTrackerPanelProps = {
  selectedMonth: Date;
  pillarData: PillarData[];
  selectedFunnel: FunnelStage;
  onSelectFunnel: (stage: FunnelStage) => void;
  selectedPillarId?: string | null;
  onSelectPillar?: (pillarId: string) => void;
  headerActions?: ReactNode;
  className?: string;
};

export function ContentPillarTrackerPanel({
  selectedMonth,
  pillarData,
  selectedFunnel,
  onSelectFunnel,
  selectedPillarId,
  onSelectPillar,
  headerActions,
  className,
}: ContentPillarTrackerPanelProps) {
  const { t } = useAppTranslation();
  const funnelStats = computeFunnelStats(pillarData);
  const filteredPillars = filterPillarsByFunnel(pillarData, selectedFunnel);
  const selectedConfig = FUNNEL_CONFIG[selectedFunnel];
  const trackerTitle = t("socialMedia.contentPillarTracker.title", "Content Pillar Tracker");
  const trackerInfoDescription = t(
    "socialMedia.contentPillarTracker.infoDescription",
    TRACKER_INFO_DESCRIPTION,
  );
  const noDescriptionText = t(
    "socialMedia.contentPillarTracker.noDescription",
    "No description available.",
  );
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const HEADER_INFO_ID = "tracker-header";

  const toggleInfo = (id: string, nextOpen: boolean) => {
    setOpenInfoId(nextOpen ? id : null);
  };

  return (
    <div className={cn("bg-card", className)}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-gray-900">{trackerTitle}</h3>
            <InfoDescriptionPopover
              title={trackerTitle}
              description={trackerInfoDescription}
              ariaLabel={t("socialMedia.contentPillarTracker.infoAria", "About Content Pillar Tracker")}
              open={openInfoId === HEADER_INFO_ID}
              onOpenChange={(open) => toggleInfo(HEADER_INFO_ID, open)}
            />
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-0.5 text-[10px] text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Selected Month Distribution (
            {selectedMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" })}) - Total:{" "}
            {funnelStats.total} content
          </p>
        </div>
        {headerActions}
      </div>

      <div className="border-b border-border px-2 py-2">
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => {
              setOpenInfoId(null);
              onSelectFunnel("top");
            }}
            className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${
              selectedFunnel === "top"
                ? "border border-green-200 bg-green-100 text-green-800"
                : "bg-gray-50 text-gray-600"
            }`}
          >
            <div className="mb-1 text-sm font-semibold text-green-600">
              {funnelStats.top.percentage}% ({funnelStats.top.count})
            </div>
            <span className="text-center leading-tight">Awareness</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenInfoId(null);
              onSelectFunnel("middle");
            }}
            className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${
              selectedFunnel === "middle"
                ? "border border-yellow-200 bg-yellow-100 text-yellow-800"
                : "bg-gray-50 text-gray-600"
            }`}
          >
            <div className="mb-1 text-sm font-semibold text-yellow-600">
              {funnelStats.middle.percentage}% ({funnelStats.middle.count})
            </div>
            <span className="text-center leading-tight">Consideration</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenInfoId(null);
              onSelectFunnel("bottom");
            }}
            className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${
              selectedFunnel === "bottom"
                ? "border border-red-200 bg-red-100 text-red-800"
                : "bg-gray-50 text-gray-600"
            }`}
          >
            <div className="mb-1 text-sm font-semibold text-red-600">
              {funnelStats.bottom.percentage}% ({funnelStats.bottom.count})
            </div>
            <span className="text-center leading-tight">Conversion</span>
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div
          className="mb-3 mt-3 rounded-[5px] px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: selectedConfig.bgColor,
            color: selectedConfig.color,
          }}
        >
          {selectedConfig.label} - {selectedConfig.name}
          <span className="ml-2 text-gray-600">{filteredPillars.length} pillars</span>
        </div>

        <div className="space-y-3">
          {filteredPillars.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">No pillars found for {selectedConfig.name}</p>
            </div>
          ) : (
            filteredPillars.map((pillar) => (
              <PillarTrackerRow
                key={pillar.pillar_id}
                pillar={pillar}
                selectedConfig={selectedConfig}
                noDescriptionText={noDescriptionText}
                infoAriaLabel={t(
                  "socialMedia.contentPillarTracker.pillarInfoAria",
                  "View pillar description",
                )}
                isSelected={selectedPillarId === pillar.pillar_id}
                infoOpen={openInfoId === pillar.pillar_id}
                onInfoOpenChange={(open) => toggleInfo(pillar.pillar_id, open)}
                onSelectPillar={onSelectPillar}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
