import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { BriefClaimsField } from "./BriefClaimsField";
import { ChevronDown, Loader2 } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";
import { sameBrief, sameIds } from "./parse";
import { clampBriefPillarIds, syncPillarIdsForAngles } from "./angleCatalog";
import type { AiEmployeePageData, BriefDraft, CatalogOption } from "./types";
import { ReferenceField } from "./ReferenceField";
import { CatalogColorField, CatalogLogoField } from "./CatalogAssetsFields";
import type { useBriefPillarUsage } from "./pillarUsage";
import {
  AngleFocusField,
  CarouselExecutionCheckList,
  CarouselSystemRulesPanel,
  CatalogSelect,
  FieldHint,
  listed,
  PersonaField,
  ProductKnowledgeField,
  RepeatVoiceEditor,
  shownText,
  SubCategoryField,
  TextFieldButton,
} from "./AiEmployeeBriefFields";

type BriefRow = {
  key: string;
  label: string;
  hint?: string;
  value: ReactNode;
  editor: ReactNode;
};

const WIDE_VALUE_KEYS = new Set([
  "angles",
  "products",
  "pillars",
  "references",
  "colors",
  "logo",
  "systemHooks",
  "subCategory",
  "personas",
  "executionCheck",
  "systemRules",
]);

function BriefRowView({
  row,
  canEdit,
}: {
  row: BriefRow;
  canEdit: boolean;
}) {
  const assetRow = row.key === "colors" || row.key === "logo";
  // Color has a compact header row; nudge the label down to the swatch line.
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

type ModelFns = {
  saveReference: (position: number, file: File) => Promise<unknown>;
  clearReference: (position: number) => Promise<unknown>;
  saveCatalogColor: Parameters<typeof CatalogColorField>[0]["onSave"];
  selectCatalogColor: Parameters<typeof CatalogColorField>[0]["onSelect"];
  deleteCatalogColor: Parameters<typeof CatalogColorField>[0]["onDelete"];
  saveCatalogLogo: Parameters<typeof CatalogLogoField>[0]["onSave"];
  selectCatalogLogo: Parameters<typeof CatalogLogoField>[0]["onSelect"];
  deleteCatalogLogo: Parameters<typeof CatalogLogoField>[0]["onDelete"];
};

export type AiEmployeeBriefPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: AiEmployeePageData;
  brief: BriefDraft;
  setBrief: Dispatch<SetStateAction<BriefDraft | null>>;
  canEdit: boolean;
  saving: boolean;
  names: {
    services: Map<string, string>;
    personas: Map<string, string>;
  };
  visiblePillars: CatalogOption[];
  visibleProducts: CatalogOption[];
  pillarUsage: ReturnType<typeof useBriefPillarUsage>;
  workName: string;
  t: (key: string, fallback: string) => string;
  onReview: () => void;
  onOpenAngle: (id: string) => void;
  /** Same handler as Job Desc table "Generate sekarang". */
  generating?: boolean;
  onGenerateNow?: () => void;
  /** Needed for Klaim yang boleh dipakai. */
  employeeId?: string;
} & ModelFns;

export function AiEmployeeBriefPanel({
  open,
  onOpenChange,
  page,
  brief,
  setBrief,
  canEdit,
  saving,
  names,
  visiblePillars,
  visibleProducts,
  pillarUsage,
  workName,
  t,
  onReview,
  onOpenAngle,
  generating = false,
  onGenerateNow,
  employeeId,
  saveReference,
  clearReference,
  saveCatalogColor,
  selectCatalogColor,
  deleteCatalogColor,
  saveCatalogLogo,
  selectCatalogLogo,
  deleteCatalogLogo,
}: AiEmployeeBriefPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const hadDirtyBrief = useRef(false);
  const briefDirty = !sameBrief(page.brief, brief);
  const openMode = brief.angleIds.length === 0;

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

  const markSessionSaved = () => setSessionSaved(true);
  const withSessionSave = <Args extends unknown[], Result>(
    action: (...args: Args) => Promise<Result>,
  ) => async (...args: Args): Promise<Result> => {
    const result = await action(...args);
    markSessionSaved();
    return result;
  };
  const dismissLabel = sessionSaved && !briefDirty
    ? t("common.close", "Tutup")
    : t("common.cancel", "Batal");

  const primaryRows: BriefRow[] = [
    {
      key: "services",
      label: t("aiEmployee.brief.services", "Katalog"),
      hint: brief.serviceIds.length > 1
        ? "Masih ada lebih dari satu katalog. Pilih satu sebelum menyimpan."
        : "Satu katalog untuk karyawan ini. Katalog lain membutuhkan karyawan AI baru.",
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
            const productIds = current.productIds.filter((productId) => {
              const product = page.options.products.find((item) => item.id === productId);
              return product?.serviceId != null && allowed.has(product.serviceId);
            });
            const angleIds = current.angleIds.filter((angleId) => {
              const angle = page.options.angles.find((item) => item.id === angleId);
              return angle?.serviceId != null && allowed.has(angle.serviceId);
            });
            return {
              ...current,
              serviceIds,
              subServiceId: null,
              subServiceIds: [],
              productIds,
              angleIds,
              pillarIds: syncPillarIdsForAngles(page.options.angles, angleIds),
            };
          })}
        />
      ),
    },
    {
      key: "subCategory",
      label: t("aiEmployee.brief.subCategory", "Sub Category"),
      hint: "Bisa lebih dari satu, paling banyak 8. Kosong berarti General Content. Foto product list dari yang dipilih dikirim ke Canva. Menghapus plan tidak menghapus produk.",
      value: (
        <SubCategoryField
          organizationId={page.organizationId}
          ready={sameIds(page.brief.serviceIds, brief.serviceIds) && brief.serviceIds.length === 1}
          canEdit={canEdit}
          saving={saving}
          value={brief.subServiceIds}
          options={page.subServices.filter((item) => item.serviceId === brief.serviceIds[0])}
          onChange={(subServiceIds) => setBrief((current) => current ? { ...current, subServiceIds, subServiceId: subServiceIds[0] ?? null } : current)}
        />
      ),
      editor: null,
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
            if (!current || !page) return current;
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
    ...(employeeId
      ? [{
          key: "claims",
          label: "Klaim yang boleh dipakai",
          hint: "Hanya klaim disetujui di Daftar Klaim. Klaim brand dan klaim di Fokus angle ikut otomatis. AI hanya diberi fakta ini; plan yang memuat klaim lain tidak di-auto-approve (jadi Need Review dengan catatan). Product Knowledge tetap untuk strategi (problem, wants, hook).",
          value: <BriefClaimsField employeeId={employeeId} angleIds={brief.angleIds} disabled={saving || !canEdit} />,
          editor: null,
        }]
      : []),
    {
      key: "pillars",
      label: t("aiEmployee.brief.pillars", "Pilar"),
      hint: "Otomatis terisi dari pilar terkunci di Fokus angle (Thinking Lab atau modal). Bisa diubah manual sampai angle berubah lagi. Kosong berarti AI bebas memilih. Gembok = terkunci di idea. Angka = plan katalog ini bulan ini. TOFU/MOFU/BOFU = funnel. Paling banyak 12.",
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
      key: "products",
      label: t("aiEmployee.brief.products", "Product Knowledge"),
      value: (
        <ProductKnowledgeField
          placeholder={t("aiEmployee.brief.products", "Product Knowledge")}
          emptyLabel={brief.serviceIds.length === 0
            ? t("aiEmployee.brief.pickServiceFirst", "Pilih katalog dulu")
            : t("aiEmployee.brief.noProducts", "Tidak ada Product Knowledge untuk katalog ini")}
          options={visibleProducts}
          value={brief.productIds}
          disabled={saving || !canEdit || brief.serviceIds.length === 0}
          onChange={(productIds) => setBrief((current) => current ? { ...current, productIds } : current)}
        />
      ),
      editor: null,
    },
    {
      key: "colors",
      label: t("aiEmployee.brief.colors", "Referensi warna"),
      value: (
        <CatalogColorField
          blocked={page.brief.serviceIds.length === 1
            ? (sameIds(page.brief.serviceIds, brief.serviceIds) ? null : "Simpan katalog dulu.")
            : "Pilih satu katalog dulu."}
          canEdit={canEdit}
          colors={page.brandColors}
          selectedId={page.brandColorId}
          onSave={withSessionSave(saveCatalogColor)}
          onSelect={withSessionSave(selectCatalogColor)}
          onDelete={withSessionSave(deleteCatalogColor)}
        />
      ),
      editor: null,
    },
    {
      key: "logo",
      label: t("aiEmployee.brief.logo", "Brand lockup"),
      hint: "Brand = nama katalog. Tagline, hashtag, dan logo ikut katalog yang dipilih.",
      value: (
        <CatalogLogoField
          blocked={page.brief.serviceIds.length === 1
            ? (sameIds(page.brief.serviceIds, brief.serviceIds) ? null : "Simpan katalog dulu.")
            : "Pilih satu katalog dulu."}
          canEdit={canEdit}
          brandName={brief.serviceIds.length === 1 ? (names.services.get(brief.serviceIds[0]) ?? "") : ""}
          logos={page.companyLogos}
          selectedId={page.companyLogoId}
          onSave={withSessionSave(saveCatalogLogo)}
          onSelect={withSessionSave(selectCatalogLogo)}
          onDelete={withSessionSave(deleteCatalogLogo)}
        />
      ),
      editor: null,
    },
    {
      key: "systemHooks",
      label: t("aiEmployee.brief.systemHooks", "Hook sistem"),
      hint: "Centang = Hook headline dari tab Hooks Product Knowledge (placeholder diisi AI). Visual hook tetap AI. Tidak centang = AI mencari hook sendiri.",
      value: (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-900">
              {brief.useSystemHooks
                ? "Pakai hook Product Knowledge"
                : "AI mencari hook"}
            </p>
            <a
              href="/digital-marketing/social-media/product-knowledge"
              className="text-xs text-blue-600 hover:underline"
            >
              Kelola Hooks
            </a>
          </div>
          <Switch
            checked={brief.useSystemHooks}
            disabled={!canEdit || saving}
            onCheckedChange={(checked) => setBrief((current) => current ? { ...current, useSystemHooks: checked } : current)}
            aria-label={t("aiEmployee.brief.systemHooks", "Hook sistem")}
          />
        </div>
      ),
      editor: null,
    },
    {
      key: "voice",
      label: t("aiEmployee.brief.voice", "Suara"),
      hint: "Nada tulisan plan pertama. Naya memakai ini sebagai gaya bahasa.",
      value: shownText(brief.voice),
      editor: (
        <TextFieldButton
          label={t("aiEmployee.brief.edit", "Ubah")}
          value={brief.voice}
          maxLength={1000}
          disabled={saving}
          onChange={(voice) => setBrief((current) => current ? { ...current, voice } : current)}
        />
      ),
    },
    {
      key: "required",
      label: t("aiEmployee.brief.required", "Catatan wajib"),
      hint: "Instruksi untuk plan, misalnya cantumkan nomor telepon atau harga. Yang masuk ke plan adalah faktanya. Kosong berarti tidak ada instruksi.",
      value: shownText(brief.requiredNotes),
      editor: (
        <TextFieldButton
          label={t("aiEmployee.brief.edit", "Ubah")}
          value={brief.requiredNotes}
          maxLength={2000}
          disabled={saving}
          onChange={(requiredNotes) => setBrief((current) => current ? { ...current, requiredNotes } : current)}
        />
      ),
    },
    {
      key: "forbidden",
      label: t("aiEmployee.brief.forbidden", "Catatan terlarang"),
      hint: "Hal yang tidak boleh muncul di plan. Kosong berarti tidak ada larangan.",
      value: shownText(brief.forbiddenNotes),
      editor: (
        <TextFieldButton
          label={t("aiEmployee.brief.edit", "Ubah")}
          value={brief.forbiddenNotes}
          maxLength={2000}
          disabled={saving}
          onChange={(forbiddenNotes) => setBrief((current) => current ? { ...current, forbiddenNotes } : current)}
        />
      ),
    },
  ];

  const advancedRows: BriefRow[] = [
    {
      key: "executionCheck",
      label: t("aiEmployee.brief.executionCheck", "Cek kualitas (execution)"),
      hint: t(
        "aiEmployee.brief.executionCheckHint",
        "Saat ON, draf dinilai 10 poin sebelum plan disimpan. Saat OFF, langkah itu dilewati; aturan generate (sistem) tetap berlaku.",
      ),
      value: (
        <div className="space-y-1 py-0.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-900">
              {brief.executionCheckEnabled
                ? t("aiEmployee.brief.executionCheckOn", "10 poin dinilai sebelum simpan")
                : t("aiEmployee.brief.executionCheckOff", "Dilewati (saklar OFF)")}
            </p>
            <Switch
              checked={brief.executionCheckEnabled}
              disabled={!canEdit || saving}
              onCheckedChange={(checked) =>
                setBrief((current) => (current ? { ...current, executionCheckEnabled: checked } : current))
              }
              aria-label={t("aiEmployee.brief.executionCheck", "Cek kualitas (execution)")}
            />
          </div>
          <CarouselExecutionCheckList />
        </div>
      ),
      editor: null,
    },
    {
      key: "systemRules",
      label: t("aiEmployee.brief.systemRules", "Aturan generate (sistem)"),
      hint: t(
        "aiEmployee.brief.systemRulesHint",
        "Selalu aktif untuk Generate sekarang dan jadwal. Tidak bisa dimatikan per brief. Angka harus sama dengan validator SOP1.",
      ),
      value: <CarouselSystemRulesPanel />,
      editor: null,
    },
    {
      key: "personas",
      label: t("aiEmployee.brief.personas", "Persona"),
      hint: openMode
        ? undefined
        : "Hanya dipakai saat Fokus angle kosong (mode terbuka).",
      value: (
        <PersonaField
          canEdit={canEdit}
          saving={saving}
          value={brief.personaIds}
          options={page.options.personas}
          labels={names.personas}
          emptyLabel={t("aiEmployee.brief.noPersonas", "Tidak ada persona")}
          onChange={(personaIds) => setBrief((current) => current ? { ...current, personaIds } : current)}
        />
      ),
      editor: null,
    },
    {
      key: "audience",
      label: t("aiEmployee.brief.audience", "Audiens"),
      hint: openMode
        ? undefined
        : "Hanya dipakai saat Fokus angle kosong (mode terbuka).",
      value: shownText(brief.audience),
      editor: (
        <TextFieldButton
          label={t("aiEmployee.brief.edit", "Ubah")}
          value={brief.audience}
          maxLength={1000}
          disabled={saving}
          onChange={(audience) => setBrief((current) => current ? { ...current, audience } : current)}
        />
      ),
    },
    {
      key: "references",
      label: t("aiEmployee.brief.references", "Referensi layout"),
      hint: "Untuk penanda slot di script (label Referensi N). Canva tidak memakai gambar ini.\n\nKlik kotak, lalu tempel gambar. Tempel tersimpan langsung dan tidak lewat tinjau brief.",
      value: (
        <ReferenceField
          references={page.references}
          canEdit={canEdit}
          onSave={withSessionSave(async (position: number, file: File) => {
            await saveReference(position, file);
          })}
          onClear={withSessionSave(async (position: number) => {
            await clearReference(position);
          })}
        />
      ),
      editor: null,
    },
    {
      key: "repeatVoices",
      label: t("aiEmployee.brief.repeatVoices", "Gaya pengulangan"),
      hint: "Hanya untuk plan kedua pada idea dan pilar yang sama, setelah plan pertama tayang lebih dari 7 hari dan metriknya di atas median. Yang dipakai hanya gaya pertama. Kosong berarti tidak ada pengulangan.",
      value: brief.repeatVoices.length > 0 ? brief.repeatVoices.join("\n") : "—",
      editor: (
        <RepeatVoiceEditor
          label={t("aiEmployee.brief.edit", "Ubah")}
          value={brief.repeatVoices}
          disabled={saving}
          onChange={(repeatVoices) => setBrief((current) => current ? { ...current, repeatVoices } : current)}
        />
      ),
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
                  text={"Berlaku untuk Content Plan Carousel. Field yang diisi menjadi batas. Field yang dikosongkan melepas batas itu.\n\nAturan generate ada di Advanced (sistem, read-only).\n\nKatalog paling banyak satu. Kosong berarti plan tidak dibuat. Satu katalog untuk karyawan ini. Katalog lain membutuhkan karyawan AI baru.\n\nFokus angle paling banyak 6.\nFokus angle kosong: tidak ada giliran angle. Idea yang dikunci dan lolos dari angle mana pun ikut. Yang belum punya plan didahulukan. Setelah semua idea punya plan, giliran tetap merata: jumlah plan paling sedikit, lalu yang paling lama tidak dipakai. Idea dan pilar plan terakhir dilewati selama masih ada pilihan. Angle ikut terbawa dari idea.\nFokus angle diisi: giliran menjauh dari plan organisasi yang tanggal postingnya paling baru. Angle yang paling lama tidak keluar didahulukan, dan angle plan terakhir dilewati selama angle lain masih punya idea yang lolos. Idea di angle itu dipilih yang jumlah plannya paling sedikit, lalu yang paling lama tidak dipakai. Idea plan terakhir tidak diulang selama masih ada idea lain yang jumlahnya sama atau lebih sedikit. Idea yang sama boleh kembali lewat pilar yang belum pernah dipasangkan. Persona dan audiens tidak dikirim.\n\nPilar kosong: pilar diambil dari pilar aktif di Content Pillar Tracker. Yang paling sedikit dipakai pada bulan berjalan didahulukan. Pilar plan terakhir dilewati selama masih ada pilar lain yang belum dipasangkan dengan idea itu.\nPilar diisi: giliran hanya di dalam daftar itu, dengan urutan yang sama.\nPasangan idea dan pilar yang sama tidak dibuat dua kali.\n\nProduct Knowledge kosong: daftarnya semua baris yang kategorinya sama dengan katalog.\nProduct Knowledge diisi: hanya baris itu.\nSaat fokus angle terisi, Naya memilih dari daftar itu (paling banyak 30) dan pilihannya dipakai selama ada di daftar.\nSaat fokus angle kosong, yang dikirim paling banyak 3 baris, dan baris yang sudah terpakai dilewati.\n\nReferensi layout (Advanced): penanda slot di script, bukan desain Canva. Tempel tersimpan langsung.\n\nSuara kosong: tidak ada gaya bahasa.\nCatatan wajib adalah instruksi. Caption dan teks slide terakhir memenuhi maksudnya. Nomor telepon, harga, atau fakta lain di dalam instruksi itu yang muncul, lalu ikut ke Canva. Kalimat instruksinya tidak disalin.\nCatatan terlarang tidak boleh muncul di judul, caption, concept, visual, teks, atau element, dan ikut sebagai larangan ke Canva.\nBila adegan memuat orang, gambar diminta sebagai foto manusia sungguhan, bukan ilustrasi.\nGaya pengulangan (Advanced) kosong: tidak ada plan kedua. Gaya pertama dipakai hanya setelah plan pertama tayang lebih dari 7 hari dan metriknya di atas median."}
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
                    text="Berlaku untuk generate sekarang dan jadwal harian. Plan baru langsung Approved."
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {brief.contentPlanAutoApprove
                    ? "Plan baru langsung Approved."
                    : "Plan baru menunggu review."}
                </p>
              </div>
              <Switch
                checked={brief.contentPlanAutoApprove}
                disabled={!canEdit || saving}
                onCheckedChange={(checked) => setBrief((current) => current ? { ...current, contentPlanAutoApprove: checked } : current)}
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
            <TableRow>
              <TableCell colSpan={canEdit ? 3 : 2} className="py-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((current) => !current)}
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
                  {t("aiEmployee.brief.advanced", "Advanced")}
                </button>
              </TableCell>
            </TableRow>
            {advancedOpen
              ? advancedRows.map((row) => (
                <BriefRowView key={row.key} row={row} canEdit={canEdit} />
              ))
              : null}
          </TableBody>
        </Table>
        <DialogFooter>
          {canEdit && brief.serviceIds.length > 1 ? (
            <p className="mr-auto text-xs text-muted-foreground">Pilih satu katalog sebelum menyimpan.</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={saving || generating}
            onClick={() => onOpenChange(false)}
          >
            {dismissLabel}
          </Button>
          {canEdit && onGenerateNow ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saving || generating || briefDirty || brief.serviceIds.length !== 1}
              aria-busy={generating}
              onClick={() => {
                void onGenerateNow();
              }}
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {generating
                ? t("aiEmployee.schedule.generating", "Membuat plan...")
                : t("aiEmployee.schedule.generateNow", "Generate sekarang")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              disabled={saving || generating || brief.serviceIds.length > 1 || !briefDirty}
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
