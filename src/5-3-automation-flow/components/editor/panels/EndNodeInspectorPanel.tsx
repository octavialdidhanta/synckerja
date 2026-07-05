import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Zap } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  getJumpTargetCandidates,
  mergeEndNodePatch,
  normalizeEndNodeData,
} from "@/5-3-automation-flow/lib/graph/endNodeData";
import type {
  AutomationFlowEndMode,
  AutomationFlowGraph,
  AutomationFlowGraphNode,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

type EndNodeInspectorPanelProps = {
  graph: AutomationFlowGraph;
  node: AutomationFlowGraphNode;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

export function EndNodeInspectorPanel({ graph, node, onUpdateNode }: EndNodeInspectorPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const endData = normalizeEndNodeData(node.data as Record<string, unknown>);
  const mode = endData.mode ?? "flow_end";
  const candidates = getJumpTargetCandidates(graph);
  const selected = candidates.find((c) => c.nodeId === endData.jumpToNodeId);

  const patch = (data: Record<string, unknown>) => {
    onUpdateNode(node.id, mergeEndNodePatch(node.data as Record<string, unknown>, data));
  };

  const setMode = (nextMode: AutomationFlowEndMode) => {
    patch({ mode: nextMode });
  };

  const actionLabel = (actionNumber: number) =>
    t("omnichannel.automationFlow.editor.canvas.actionLabel", {
      number: actionNumber,
      defaultValue: "Action {{number}}",
    });

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex border-b border-border">
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center px-3 py-2.5 text-sm font-semibold transition-colors",
              mode === "flow_end"
                ? "bg-gray-800 text-white"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
            onClick={() => setMode("flow_end")}
          >
            {t("omnichannel.automationFlow.editor.endMode.flowEnd", "Flow end")}
          </button>
          <div className="w-px shrink-0 bg-border" aria-hidden />
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center px-3 py-2.5 text-sm font-semibold transition-colors",
              mode === "jump_to"
                ? "bg-gray-800 text-white"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
            onClick={() => setMode("jump_to")}
          >
            {t("omnichannel.automationFlow.editor.endMode.jumpTo", "Jump to")}
          </button>
        </div>
        <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {mode === "jump_to"
            ? t(
                "omnichannel.automationFlow.editor.endMode.jumpToHint",
                "The flow can jump to another node if available, otherwise it will end here",
              )
            : t(
                "omnichannel.automationFlow.editor.endMode.flowEndHint",
                "The flow will end when it reaches this node",
              )}
        </p>
      </div>

      {mode === "jump_to" ? (
        <div className="space-y-2">
          <SectionLabel>
            {t("omnichannel.automationFlow.editor.endMode.jumpToNode", "Jump to node")}
          </SectionLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-10 w-full justify-between font-normal"
              >
                {selected ? (
                  <span className="flex items-center gap-2 truncate">
                    <Zap className="h-4 w-4 shrink-0 text-blue-600" />
                    {actionLabel(selected.actionNumber)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("omnichannel.automationFlow.editor.endMode.selectTarget", "Please select")}
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={t(
                    "omnichannel.automationFlow.editor.endMode.searchTarget",
                    "Search action…",
                  )}
                />
                <CommandList
                  className={cn(
                    "scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[min(240px,45vh)]",
                    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  )}
                >
                  <CommandEmpty>
                    {t("omnichannel.automationFlow.editor.endMode.noTargets", "No actions found.")}
                  </CommandEmpty>
                  <CommandGroup>
                    {candidates.map((candidate) => (
                      <CommandItem
                        key={candidate.nodeId}
                        value={actionLabel(candidate.actionNumber)}
                        onSelect={() => {
                          patch({ mode: "jump_to", jumpToNodeId: candidate.nodeId });
                          setOpen(false);
                        }}
                      >
                        <Zap className="mr-2 h-4 w-4 shrink-0 text-blue-600" />
                        {actionLabel(candidate.actionNumber)}
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            endData.jumpToNodeId === candidate.nodeId ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </div>
  );
}
