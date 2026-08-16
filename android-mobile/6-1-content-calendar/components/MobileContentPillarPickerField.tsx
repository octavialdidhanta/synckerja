import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Drawer,
  DrawerContent,
} from "@/shared/components/ui/drawer";
import { cn } from "@/shared/lib/utils";
import { useContentPillarData } from "@/6-1-dashboard/hook/useContentPillarData";
import { type FunnelStage } from "@/6-1-dashboard/lib/contentPillarTracker";
import { ContentPillarTrackerPanel } from "@/mobile/6-1-content-calendar/components/ContentPillarTrackerPanel";
import { MobileFunnelSectionPulse } from "@/mobile/6-1-content-calendar/sections/MobileFunnelSection";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  selectedMonth: Date;
  serviceFilter?: string;
  onChange: (pillarId: string) => void;
};

export function MobileContentPillarPickerField({
  label,
  value,
  placeholder,
  selectedMonth,
  serviceFilter = "all",
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedFunnel, setSelectedFunnel] = useState<FunnelStage>("top");
  const { data: pillarData = [], isLoading, error } = useContentPillarData(
    selectedMonth,
    serviceFilter,
  );

  const selected = useMemo(
    () => pillarData.find((pillar) => pillar.pillar_id === value),
    [pillarData, value],
  );

  useEffect(() => {
    if (!open || !selected) return;
    setSelectedFunnel(selected.funnel);
  }, [open, selected]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 w-full justify-between px-2.5 text-xs font-normal"
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.pillar_name : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
      <Drawer shouldScaleBackground={false} open={open} onOpenChange={setOpen}>
        <DrawerContent
          className="z-[1000003] max-h-[90vh] px-0 pb-3"
          overlayClassName="z-[1000002]"
        >
          <div className="scrollbar-hide max-h-[min(78vh,640px)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {isLoading ? (
              <MobileFunnelSectionPulse className="mx-0" />
            ) : error ? (
              <p className="px-4 py-8 text-center text-sm text-red-600">Error loading data</p>
            ) : (
              <ContentPillarTrackerPanel
                selectedMonth={selectedMonth}
                pillarData={pillarData}
                selectedFunnel={selectedFunnel}
                onSelectFunnel={setSelectedFunnel}
                selectedPillarId={value || null}
                onSelectPillar={(pillarId) => {
                  onChange(pillarId);
                  setOpen(false);
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
