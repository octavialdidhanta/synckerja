import { Loader2, ClipboardCheck, MoreVertical, Sparkles } from "lucide-react";
import { beliefsMatch } from "@/thinking-lab/master-thought/semantic";
import { Accordion } from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { MasterCatalogPicker } from "@/thinking-lab/section/MasterCatalogPicker";
import { ProductBeliefSource } from "@/thinking-lab/section/ProductBeliefSource";
import { SavedMasterThoughtList } from "@/thinking-lab/section/SavedMasterThoughtList";
import { MasterCatalogField } from "@/thinking-lab/section/MasterCatalogField";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";
import { ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { BigThoughtSection } from "@/thinking-lab/section/BigThoughtSection";
import { NodeDefinitionInfo } from "@/thinking-lab/section/LabNodeInspector";
import { ContentUsageAudit } from "@/6-1-dashboard/modal/ContentUsageAudit";
import type { LabMasterComposerProps, LabMasterSavedListProps, LabMasterSectionProps } from "@/thinking-lab/page/shells/labWorkspaceGridTypes";

export function LabMasterComposer({
  t,
  busy,
  busyAction,
  newCatalog,
  setNewCatalog,
  catalogs,
  setReasonPool,
  newPrior,
  setNewPrior,
  newPlanted,
  setNewPlanted,
  newAudience,
  setNewAudience,
  onCreate,
}: LabMasterComposerProps) {
  return (
    
        <div
          className={cn(
            "scrollbar-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
        <div className="shrink-0">
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
            {t("thinkingLab.composer.headline", "Master Thought baru")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t(
              "thinkingLab.composer.lead",
              "Pilih kategori, lalu tulis keyakinan lama dan keyakinan barunya.",
            )}
          </p>
        </div>
        <div className="shrink-0 space-y-1 text-sm font-medium text-foreground">
          {t("thinkingLab.catalog.label", "Kategori")}
          <MasterCatalogPicker
            value={newCatalog}
            catalogs={catalogs.data ?? []}
            disabled={busy}
            onChange={setNewCatalog}
          />
          <ProductBeliefSource
            link={newCatalog}
            catalogs={catalogs.data ?? []}
            disabled={busy}
            onPoolChange={setReasonPool}
            onApply={(draft) => {
              setNewPrior(draft.priorBelief);
              setNewPlanted(draft.plantedBelief);
              setNewAudience(draft.audience);
            }}
          />
        </div>
        <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
          {t("thinkingLab.master.prior", "Old belief (false belief)")}
        <Textarea
            value={newPrior}
            onChange={(event) => setNewPrior(event.target.value)}
            rows={2}
            className="mt-1 font-normal"
            placeholder={t(
              "thinkingLab.master.priorPlaceholder",
              "Example: the fastest bike is the most important thing to chase right now",
            )}
          />
        </label>
        <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
          {t("thinkingLab.master.planted", "New belief (belief shift)")}
          <Textarea
            value={newPlanted}
            onChange={(event) => setNewPlanted(event.target.value)}
            rows={2}
            className="mt-1 font-normal"
            placeholder={t(
              "thinkingLab.master.plantedPlaceholder",
              "Example: money while young is more valuable when saved",
            )}
          />
        </label>
        <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
          {t("thinkingLab.master.audience", "Target audience (optional)")}
          <Textarea
            value={newAudience}
            onChange={(event) => setNewAudience(event.target.value)}
            rows={2}
            className="mt-1 font-normal"
            placeholder={t(
              "thinkingLab.master.audiencePlaceholder",
              "Example: teenage boys who love motorbikes",
            )}
          />
        </label>
        <Button
          type="button"
          className="shrink-0"
          onClick={onCreate}
          disabled={
            busy ||
            !newCatalog.serviceId ||
            !newPrior.trim() ||
            !newPlanted.trim() ||
            beliefsMatch(newPrior, newPlanted)
          }
          aria-busy={busyAction === "save-master" || undefined}
        >
          {busyAction === "save-master" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.saveMaster", "Simpan Master Thought")}
        </Button>
        </div>
    
  );
}

export function LabMasterSavedList({
  masters,
  catalogs,
  closeComposer,
  skipAutoSelect,
  setSelectedId,
  setFocus,
  setPendingDelete,
}: LabMasterSavedListProps) {
  return (
    
        <SavedMasterThoughtList
          masters={masters.data ?? []}
          catalogs={catalogs.data ?? []}
          catalogPending={masters.saveCatalog.isPending}
          onSaveCatalog={(id, catalog) => {
            void masters.saveCatalog.mutateAsync({ id, catalog });
          }}
          onOpen={(id) => {
            const row = masters.data?.find((item) => item.id === id);
            closeComposer();
            skipAutoSelect.current = false;
            setSelectedId(id);
            setFocus(row?.mtStatus === "locked" ? { kind: "master", masterId: id } : null);
          }}
          onDelete={(id) => setPendingDelete({ kind: "master", id })}
        />
    
  );
}

export function LabMasterSectionArea({
  t,
  masters,
  selected,
  hasMasters,
  showComposer,
  ready,
  locked,
  showBeliefField,
  editingBelief,
  masterMenuStage,
  showGenerateBigThought,
  busy,
  busyAction,
  masterSubject,
  masterDescription,
  catalogs,
  onGenerate,
  onAudit,
  onLock,
  onSuggestBeliefs,
  onSaveMaster,
  priorDraft,
  originalDraft,
  audienceDraft,
  setPriorDraft,
  setOriginalDraft,
  setAudienceDraft,
  showManualBigThought,
  setShowManualBigThought,
  onManualBigThought,
  becauseParent,
  shownRowViews,
  notice,
  auditProgress,
  generateChecklist,
  onGenerateTerritory,
  onEditBigThought,
  setPendingDelete,
  onFixBigThought,
  bigThoughtChecklists,
  fixingBigThoughtCodes,
}: LabMasterSectionProps) {
  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        {(masters.data ?? []).length === 0
          ? t("thinkingLab.list.empty", "Create a Master Thought to begin.")
          : t("thinkingLab.list.select", "Select a Master Thought from the list.")}
      </p>
    );
  }
  return (
    <>
      
                                  <>
                                    {(ready || locked) && !showBeliefField ? (
                                      <header className="space-y-2 border-b border-border pb-3">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <span>{t("thinkingLab.tree.masterThought", "Master Thought")}</span>
                                            <NodeDefinitionInfo kind="master" />
                                          </p>
                                          {!editingBelief && (masterMenuStage || showGenerateBigThought) && busyAction !== "manual-big-thought" ? (
                                            <DropdownMenu modal={false}>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-7 w-7 shrink-0"
                                                  aria-label={t("thinkingLab.action.more", "More actions")}
                                                >
                                                  <MoreVertical className="h-3.5 w-3.5" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="min-w-[11rem]">
                                                {showGenerateBigThought ? (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer gap-2"
                                                    disabled={busy}
                                                    onSelect={() => {
                                                      window.setTimeout(() => void onGenerate(), 0);
                                                    }}
                                                  >
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    {t("thinkingLab.bt.generate", "Generate Big Thought")}
                                                  </DropdownMenuItem>
                                                ) : null}
                                                {masterMenuStage ? (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer gap-2"
                                                    disabled={busy}
                                                    onSelect={() => {
                                                      window.setTimeout(() => {
                                                        if (masterMenuStage === "generate") void onGenerate();
                                                        else if (masterMenuStage === "audit") void onAudit();
                                                        else void onLock();
                                                      }, 0);
                                                    }}
                                                  >
                                                    {masterMenuStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                                                    {masterMenuStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                                                    {masterMenuStage === "generate"
                                                      ? t("thinkingLab.bt.generate", "Generate Big Thought")
                                                      : masterMenuStage === "audit"
                                                        ? t("thinkingLab.action.audit", "Audit")
                                                        : t("thinkingLab.action.lock", "Lock")}
                                                  </DropdownMenuItem>
                                                ) : null}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          ) : null}
                                        </div>
                                        <h2 className="max-w-[46rem] whitespace-normal break-words text-base font-semibold leading-snug text-foreground">
                                          {masterSubject || selected.statement || selected.originalInput}
                                        </h2>
                                        {masterSubject && masterDescription.trim() !== masterSubject ? (
                                          <p className="text-sm text-foreground">{masterDescription}</p>
                                        ) : null}
                                        {selected.audience.trim() && masterDescription === (selected.statement || selected.originalInput).trim() ? (
                                          <p className="text-sm text-muted-foreground">
                                            {t("thinkingLab.master.audience", "Target audience (optional)")}: {selected.audience}
                                          </p>
                                        ) : null}
                                        <MasterCatalogField
                                          value={selected.catalog}
                                          catalogs={catalogs.data ?? []}
                                          pending={masters.saveCatalog.isPending}
                                          onSave={(catalog) => {
                                            void masters.saveCatalog.mutateAsync({ id: selected.id, catalog });
                                          }}
                                        />
                                        {selected.productReasonPool ? (
                                          <p className="text-sm text-muted-foreground">
                                            {selected.productReasonPool.items.length > 0
                                              ? t(
                                                  "thinkingLab.product.attached",
                                                  "{{name}}: {{count}} alasan tersimpan untuk Big Thought.",
                                                  {
                                                    name: selected.productReasonPool.serviceName,
                                                    count: selected.productReasonPool.items.length,
                                                  },
                                                )
                                              : t(
                                                  "thinkingLab.product.poolEmpty",
                                                  "{{name}} belum punya alasan tersimpan. Generate Big Thought akan berhenti.",
                                                  { name: selected.productReasonPool.serviceName },
                                                )}
                                          </p>
                                        ) : null}
                                      </header>
                                    ) : null}
                                    {showBeliefField ? (
                                      <MasterThoughtSection
                                        locked={locked}
                                        busy={busy}
                                        suggesting={busyAction === "suggest-belief"}
                                        saving={busyAction === "save-master"}
                                        priorDraft={priorDraft}
                                        originalDraft={originalDraft}
                                        audienceDraft={audienceDraft}
                                        options={selected.canonicalSemantic?.beliefOptions ?? []}
                                        confirmedStatement={ready ? selected.statement : null}
                                        onPriorChange={setPriorDraft}
                                        onOriginalChange={setOriginalDraft}
                                        onAudienceChange={setAudienceDraft}
                                        onSuggest={() => void onSuggestBeliefs()}
                                        onSave={() => void onSaveMaster()}
                                      />
                                    ) : null}
                                    {showManualBigThought && (ready || locked) && !editingBelief && selected.statement && busyAction !== "generate" ? (
                                      <ManualStatementForm
                                        label={t("thinkingLab.manual.bigThought", "Big Thought label")}
                                        hint={t(
                                          "thinkingLab.manual.bigThoughtHint",
                                          "Type 1–3 words, for example Dish Quality. The AI writes the Key Belief for that label.",
                                        )}
                                        placeholder={t("thinkingLab.manual.bigThoughtPlaceholder", "Dish Quality")}
                                        rows={2}
                                        submitLabel={t("thinkingLab.manual.save", "Save")}
                                        pending={busyAction === "manual-big-thought"}
                                        onSubmit={async (value) => {
                                          const reason = await onManualBigThought(value);
                                          if (!reason) setShowManualBigThought(false);
                                          return reason;
                                        }}
                                      />
                                    ) : null}
                                        {(ready || locked || shownRowViews.length > 0) && !editingBelief ? (
                                          <BigThoughtSection
                                        parentStatement={becauseParent}
                                            rows={shownRowViews}
                                            notice={notice}
                                            auditProgress={auditProgress}
                                            generateBusy={busy}
                                            generating={busyAction === "generate"}
                                            generateChecklist={generateChecklist}
                                            onGenerateTerritory={(bigThoughtId) => void onGenerateTerritory(bigThoughtId)}
                                        onEditBigThought={onEditBigThought}
                                            onDeleteBigThought={(bigThoughtId) =>
                                          setPendingDelete({ kind: "bigThought", id: bigThoughtId })
                                        }
                                            onFixBigThought={(code) => onFixBigThought(code)}
                                            checklists={bigThoughtChecklists}
                                            fixingCodes={fixingBigThoughtCodes}
                                          />
                                        ) : null}
                                  </>
      {selected && !(showComposer && hasMasters) ? (
        <Accordion type="single" collapsible className="mt-3">
          <ContentUsageAudit masterThoughtId={selected.id} />
        </Accordion>
      ) : null}
    </>
  );
}
