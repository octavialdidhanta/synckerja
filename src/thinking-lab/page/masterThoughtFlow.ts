import { toast } from "sonner";
import { askThinkingLab } from "@/thinking-lab/shared/ai";
import { checkWrittenBelief, collectBeliefOptions, beliefsMatch } from "@/thinking-lab/master-thought/semantic";
import type { BeliefOption, LabMasterThought, MasterCatalogContext } from "@/thinking-lab/master-thought/types";
import type { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import { catalogContext, EMPTY_CATALOG_LINK, type LabCatalog, type MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";
import type { CheckLevel } from "@/thinking-lab/shared/checkSettings";
import type { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { LabRunFns } from "@/thinking-lab/page/labRunContext";

export type MasterThoughtFlowDeps = LabRunFns & {
  t: ReturnType<typeof useAppTranslation>["t"];
  masters: ReturnType<typeof useMasterThought>;
  skipFor: (level: CheckLevel) => string[];
  catalogRequiredMessage: () => string;
  selected: LabMasterThought | null;
  selectedCatalog: MasterCatalogContext | null;
  originalDraft: string;
  priorDraft: string;
  audienceDraft: string;
  reasonPool: string[] | null;
  newPrior: string;
  setNewPrior: (v: string) => void;
  newPlanted: string;
  setNewPlanted: (v: string) => void;
  newAudience: string;
  setNewAudience: (v: string) => void;
  setReasonPool: (v: string[] | null) => void;
  newCatalog: MasterCatalogLink;
  setNewCatalog: (v: MasterCatalogLink) => void;
  catalogs: { data?: LabCatalog[] };
  setComposerOpen: (v: boolean) => void;
  setSelectedId: (v: string | null) => void;
  skipAutoSelect: { current: boolean };
  setEditingMasterId: (v: string | null) => void;
  bindUsage: (action?: string | null, masterThoughtId?: string | null, target?: string | null) => void;
};

function masterCheckMessage(t: MasterThoughtFlowDeps["t"], reasons: string[], catalogRequiredMessage: () => string): string {
  return reasons
    .map((reason) => {
      if (reason === "CATALOG_REQUIRED") return catalogRequiredMessage();
      if (reason === "PRIOR_REQUIRED") return t("thinkingLab.master.priorRequired", "Tulis keyakinan lama dulu.");
      if (reason === "SAME_BELIEF") {
        return t("thinkingLab.master.sameBelief", "The old belief and the new belief say the same thing. Change the new belief.");
      }
      if (reason === "UNDECIDED") return t("thinkingLab.mt.writtenUndecided", "The check could not be decided.");
      return reason;
    })
    .join(" ");
}

export async function saveMasterBelief(
  ctx: Pick<MasterThoughtFlowDeps, "t" | "masters" | "skipFor" | "catalogRequiredMessage">,
  input: {
    id: string;
    planted: string;
    priorBelief: string;
    audience: string;
    catalog: MasterCatalogContext | null;
    options: BeliefOption[];
  },
): Promise<boolean> {
  const check = await checkWrittenBelief(
    { belief: input.planted, priorBelief: input.priorBelief, catalog: input.catalog, skip: ctx.skipFor("master") },
    (prompt) => askThinkingLab(prompt, 0),
  );
  if (!check.pass) {
    toast.error(
      ctx
        .t(
          "thinkingLab.mt.saveFailed",
          "Master Thought belum bisa disimpan: {{reasons}} Edit kalimatnya, atau pakai Bantu rumuskan.",
        )
        .replace("{{reasons}}", masterCheckMessage(ctx.t, check.reasons, ctx.catalogRequiredMessage)),
      { duration: 12000 },
    );
    return false;
  }
  await ctx.masters.saveOriginal.mutateAsync({
    id: input.id,
    planted: input.planted,
    priorBelief: input.priorBelief,
    audience: input.audience,
  });
  await ctx.masters.confirm.mutateAsync({
    id: input.id,
    statement: input.planted,
    source: input.options.some((option) => beliefsMatch(option.belief, input.planted)) ? "recommendation" : "original",
  });
  return true;
}

export function createMasterThoughtActions(ctx: MasterThoughtFlowDeps) {
  const onCreate = () =>
    ctx.run(async () => {
      const planted = ctx.newPlanted.trim();
      const priorBelief = ctx.newPrior.trim();
      const audience = ctx.newAudience.trim();
      const catalog = catalogContext(ctx.newCatalog, ctx.catalogs.data ?? []);
      if (!catalog) throw new Error(ctx.catalogRequiredMessage());
      const created = await ctx.masters.create.mutateAsync({
        planted,
        priorBelief,
        audience,
        productReasonPool: ctx.reasonPool,
        catalog: ctx.newCatalog,
      });
      ctx.bindUsage("save-master", created.id);
      ctx.setNewPrior("");
      ctx.setNewPlanted("");
      ctx.setNewAudience("");
      ctx.setReasonPool(null);
      ctx.setNewCatalog(EMPTY_CATALOG_LINK);
      ctx.setComposerOpen(false);
      ctx.skipAutoSelect.current = false;
      ctx.setSelectedId(created.id);
      await saveMasterBelief(ctx, { id: created.id, planted, priorBelief, audience, catalog, options: [] });
    }, "save-master");

  const onSuggestBeliefs = () =>
    ctx.run(async () => {
      if (!ctx.selected) return;
      if (!ctx.selectedCatalog) throw new Error(ctx.catalogRequiredMessage());
      const options = await collectBeliefOptions(
        {
          planted: ctx.originalDraft,
          priorBelief: ctx.priorDraft.trim(),
          audience: ctx.audienceDraft,
          catalog: ctx.selectedCatalog,
          skip: ctx.skipFor("master"),
        },
        (prompt) => askThinkingLab(prompt, 0.2),
        (prompt) => askThinkingLab(prompt, 0),
      );
      await ctx.masters.saveOptions.mutateAsync({ id: ctx.selected.id, options });
      if (options.length === 0) {
        toast.error(
          ctx.t("thinkingLab.master.noOptions", "Tidak ada opsi yang lolos syarat. Edit kalimatnya sendiri, lalu coba lagi."),
        );
      }
    }, "suggest-belief");

  const onSaveMaster = () =>
    ctx.run(async () => {
      if (!ctx.selected) return;
      const saved = await saveMasterBelief(ctx, {
        id: ctx.selected.id,
        planted: ctx.originalDraft.trim(),
        priorBelief: ctx.priorDraft.trim(),
        audience: ctx.audienceDraft.trim(),
        catalog: ctx.selectedCatalog,
        options: ctx.selected.canonicalSemantic?.beliefOptions ?? [],
      });
      if (saved) ctx.setEditingMasterId(null);
    }, "save-master");

  return { onCreate, onSuggestBeliefs, onSaveMaster, saveMasterBelief: (input: Parameters<typeof saveMasterBelief>[1]) => saveMasterBelief(ctx, input) };
}