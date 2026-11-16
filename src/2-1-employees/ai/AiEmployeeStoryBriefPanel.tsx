import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { clampBriefPillarIds, syncPillarIdsForAngles } from "./angleCatalog";
import { CatalogColorField } from "./CatalogAssetsFields";
import {
  AngleFocusField,
  CatalogSelect,
  FieldHint,
  listed,
  ProductKnowledgeField,
} from "./AiEmployeeBriefFields";
import { fontsForRole, googleFontsHref, normalizeBrandFont, previewStack } from "./brandFonts";
import { sameIds } from "./parse";
import type { useBriefPillarUsage } from "./pillarUsage";
import { sameStoryBrief } from "./storyBriefPayload";
import type { StoryBriefDraft } from "./storyBriefTypes";
import type { AiEmployeePageData, CatalogOption } from "./types";

type BriefRow = {
  key: string;
  label: string;
  hint?: string;
  value: ReactNode;
  editor: ReactNode;
};

const WIDE_VALUE_KEYS = new Set(["angles", "pillars", "colors", "fonts"]);

function BriefRowView({
  row,
  canEdit,
}: {
  row: BriefRow;
  canEdit: boolean;
}) {
  const assetRow = row.key === "colors" || row.key === "fonts";
  const labelClass = row.key === "colors"
    ? "align-top pt-7"
    : assetRow
      ? "align-middle"
      : "align-top";
  return (
    <TableRow>
      <TableCell className={labelClass}>
        <span className="inline-flex items-center gap-1.5">
          {row.label}
          {row.hint ? <FieldHint text={row.hint} label={row.label} /> : null}
        </span>
      </TableCell>
      {WIDE_VALUE_KEYS.has(row.key) ? (
        <TableCell
          colSpan={canEdit ? 2 : 1}
          className={assetRow ? "min-w-0 overflow-hidden py-1.5" : "whitespace-pre-wrap"}
        >
          {row.value}
        </TableCell>
      ) : (
        <>
          <TableCell className="whitespace-pre-wrap">{row.value}</TableCell>
          {canEdit ? <TableCell><div className="flex justify-end">{row.editor}</div></TableCell> : null}
        </>
      )}
    </TableRow>
  );
}

export type AiEmployeeStoryBriefPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: AiEmployeePageData;
  brief: StoryBriefDraft;
  setBrief: Dispatch<SetStateAction<StoryBriefDraft | null>>;
  canEdit: boolean;
  saving: boolean;
  names: {
    services: Map<string, string>;
  };
  visiblePillars: CatalogOption[];
  pillarUsage: ReturnType<typeof useBriefPillarUsage>;
  workName: string;
  t: (key: string, fallback: string) => string;
  onReview: () => void;
  onOpenAngle: (id: string) => void;
  saveCatalogColor: Parameters<typeof CatalogColorField>[0]["onSave"];
  selectCatalogColor: Parameters<typeof CatalogColorField>[0]["onSelect"];
  deleteCatalogColor: Parameters<typeof CatalogColorField>[0]["onDelete"];
};

export function AiEmployeeStoryBriefPanel({
  open,
  onOpenChange,
  page,
  brief,
  setBrief,
  canEdit,
  saving,
  names,
  visiblePillars,
  pillarUsage,
  workName,
  t,
  onReview,
  onOpenAngle,
  saveCatalogColor,
  selectCatalogColor,
  deleteCatalogColor,
}: AiEmployeeStoryBriefPanelProps) {
  const [sessionSaved, setSessionSaved] = useState(false);
  const hadDirtyBrief = useRef(false);
  const briefDirty = !sameStoryBrief(page.storyBrief, brief);
  const fontPreviewHref = googleFontsHref([brief.headlineFont, brief.bodyFont]);

  useEffect(() => {
    if (!open) return;
    setSessionSaved(false);
    hadDirtyBrief.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (briefDirty) {
      hadDirtyBrief.current = true;
      return;
    }
    if (hadDirtyBrief.current) {
      setSessionSaved(true);
      hadDirtyBrief.current = false;
    }
  }, [open, briefDirty]);

  useEffect(() => {
    if (!fontPreviewHref || typeof document === "undefined") return;
    const id = "ai-employee-story-brand-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = fontPreviewHref;
  }, [fontPreviewHref]);

  const markSessionSaved = () => setSessionSaved(true);
  const withSessionSave = <Args extends unknown[]>(
    action: (...args: Args) => Promise<unknown>,
  ) => async (...args: Args) => {
    const result = await action(...args);
    markSessionSaved();
    return result;
  };
  const dismissLabel = sessionSaved && !briefDirty
    ? t("common.close", "Tutup")
    : t("common.cancel", "Batal");

  const fontSelectClass =
    "mt-1 flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50";

  const primaryRows: BriefRow[] = [
    {
      key: "services",
      label: t("aiEmployee.brief.services", "Katalog"),
      hint: brief.serviceIds.length > 1
        ? "Masih ada lebih dari satu katalog. Pilih satu sebelum menyimpan."
        : "Satu katalog untuk Design Story. Katalog carousel tetap terpisah.",
      value: listed(brief.serviceIds, names.services),
      editor: (
        <CatalogSelect
          label={t("aiEmployee.brief.edit", "Ubah")}
          emptyLabel={t("aiEmployee.brief.noServices", "Tidak ada katalog")}
          options={page.options.services}
          value={brief.serviceIds}
          disabled={saving}
          onChoose={(id) => setBrief((current) => {
            if (!current) return current;
            const serviceIds = id == null ? [] : [id];
            const allowed = new Set(serviceIds);
            const angleIds = current.angleIds.filter((angleId) => {
              const angle = page.options.angles.find((item) => item.id === angleId);
              return angle?.serviceId != null && allowed.has(angle.serviceId);
            });
            return {
              ...current,
              serviceIds,
              angleIds,
              pillarIds: syncPillarIdsForAngles(page.options.angles, angleIds),
              brandColorId: sameIds(serviceIds, page.storyBrief.serviceIds) ? current.brandColorId : null,
            };
          })}
        />
      ),
    },
    {
      key: "angles",
      label: t("aiEmployee.brief.angles", "Fokus angle"),
      value: (
        <AngleFocusField
          emptyLabel={t("aiEmployee.brief.noAngles", "Tidak ada angle")}
          options={page.options.angles}
          catalogIds={brief.serviceIds}
          value={brief.angleIds}
          disabled={saving || !canEdit}
          onChange={(angleIds) => setBrief((current) => {
            if (!current) return current;
            return {
              ...current,
              angleIds,
              pillarIds: syncPillarIdsForAngles(page.options.angles, angleIds),
            };
          })}
          onOpen={onOpenAngle}
        />
      ),
      editor: null,
    },
    {
      key: "pillars",
      label: t("aiEmployee.brief.pillars", "Pilar"),
      hint: "Otomatis terisi dari pilar terkunci di Fokus angle. Bisa diubah manual sampai angle berubah lagi. Kosong berarti AI bebas memilih. Paling banyak 12.",
      value: (
        <ProductKnowledgeField
          placeholder={t("aiEmployee.brief.pillars", "Pilar")}
          emptyLabel={brief.angleIds.length === 0
            ? t("aiEmployee.brief.pickAngleFirst", "Pilih angle dulu")
            : t("aiEmployee.brief.noPillars", "Tidak ada pilar")}
          options={page.options.pillars}
          pillarGroups={{
            lockedIds: new Set(visiblePillars.map((pillar) => pillar.id)),
            usage: pillarUsage.usage,
            funnel: pillarUsage.funnel,
            labels: {
              locked: t("aiEmployee.brief.lockedPillars", "Terkunci di idea"),
              used: t("aiEmployee.brief.usedPillars", "Sudah dipakai bulan ini"),
              unused: t("aiEmployee.brief.unusedPillars", "Belum dipakai bulan ini"),
              usedTimes: (count) => `Dipakai ${count}× bulan ini`,
            },
          }}
          onOpen={pillarUsage.reload}
          value={clampBriefPillarIds(brief.pillarIds, brief.angleIds)}
          disabled={saving || !canEdit || brief.angleIds.length === 0}
          onChange={(pillarIds) => setBrief((current) => {
            if (!current) return current;
            return {
              ...current,
              pillarIds: clampBriefPillarIds(pillarIds, current.angleIds),
            };
          })}
        />
      ),
      editor: null,
    },
    {
      key: "colors",
      label: t("aiEmployee.brief.colors", "Referensi warna"),
      value: (
        <CatalogColorField
          blocked={page.storyBrief.serviceIds.length === 1
            ? (sameIds(page.storyBrief.serviceIds, brief.serviceIds) ? null : "Simpan katalog dulu.")
            : "Pilih satu katalog dulu."}
          canEdit={canEdit}
          colors={page.storyBrandColors}
          selectedId={page.storyBrief.brandColorId}
          onSave={withSessionSave(saveCatalogColor)}
          onSelect={withSessionSave(selectCatalogColor)}
          onDelete={withSessionSave(deleteCatalogColor)}
        />
      ),
      editor: null,
    },
    {
      key: "fonts",
      label: t("aiEmployee.story.fonts", "Font"),
      hint: "Font headline dan deskripsi untuk Design Story. Tidak memakai brand lockup carousel.",
      value: (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="story-headline-font">
                Headline font
              </label>
              <select
                id="story-headline-font"
                value={brief.headlineFont}
                disabled={!canEdit || saving}
                onChange={(event) => setBrief((current) => current
                  ? { ...current, headlineFont: normalizeBrandFont(event.target.value) }
                  : current)}
                className={fontSelectClass}
              >
                <option value="">Default Canva</option>
                {fontsForRole("headline").map((font) => (
                  <option key={font.canvaName} value={font.canvaName}>{font.canvaName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="story-body-font">
                Deskripsi font
              </label>
              <select
                id="story-body-font"
                value={brief.bodyFont}
                disabled={!canEdit || saving}
                onChange={(event) => setBrief((current) => current
                  ? { ...current, bodyFont: normalizeBrandFont(event.target.value) }
                  : current)}
                className={fontSelectClass}
              >
                <option value="">Default Canva</option>
                {fontsForRole("body").map((font) => (
                  <option key={font.canvaName} value={font.canvaName}>{font.canvaName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Preview tipografi</p>
            <p
              className="mt-1 text-[22px] font-bold leading-tight text-gray-900"
              style={{ fontFamily: previewStack(brief.headlineFont) }}
            >
              Headline contoh
            </p>
            <p
              className="mt-1 text-sm leading-snug text-gray-700"
              style={{ fontFamily: previewStack(brief.bodyFont) }}
            >
              Deskripsi contoh untuk Design Story.
            </p>
          </div>
        </div>
      ),
      editor: null,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" hideCloseButton>
        <DialogHeader className="space-y-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="flex items-center gap-2">
                {t("aiEmployee.brief.title", "Brief")}
                <FieldHint
                  wide
                  label={t("aiEmployee.brief.title", "Brief")}
                  text={"Berlaku untuk Design Story (SOP4), terpisah dari Content Plan Carousel.\n\nKatalog paling banyak satu. Fokus angle paling banyak 6. Pilar mengikuti angle yang dipilih.\nWarna dan font disimpan di brief Story, bukan brand lockup carousel."}
                />
              </DialogTitle>
              <DialogDescription>{workName}</DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-gray-200 bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t("aiEmployee.brief.autoApprove", "Auto approve")}
                  </p>
                  <FieldHint
                    label={t("aiEmployee.brief.autoApprove", "Auto approve")}
                    text="Berlaku untuk generate Design Story. Default hidup."
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {brief.storyAutoApprove
                    ? "Story baru langsung Approved."
                    : "Story baru menunggu review."}
                </p>
              </div>
              <Switch
                checked={brief.storyAutoApprove}
                disabled={!canEdit || saving}
                onCheckedChange={(checked) => setBrief((current) => current ? { ...current, storyAutoApprove: checked } : current)}
                aria-label={t("aiEmployee.brief.autoApprove", "Auto approve")}
              />
            </div>
          </div>
        </DialogHeader>
        <Table containerClassName="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[60vh] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{t("aiEmployee.jobDesc.part", "Bagian")}</TableHead>
              <TableHead>{t("aiEmployee.jobDesc.value", "Isi")}</TableHead>
              {canEdit ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {primaryRows.map((row) => (
              <BriefRowView key={row.key} row={row} canEdit={canEdit} />
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          {canEdit && brief.serviceIds.length > 1 ? (
            <p className="mr-auto text-xs text-muted-foreground">Pilih satu katalog sebelum menyimpan.</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {dismissLabel}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              disabled={saving || brief.serviceIds.length > 1 || !briefDirty}
              onClick={onReview}
            >
              {t("aiEmployee.brief.review", "Tinjau brief")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
