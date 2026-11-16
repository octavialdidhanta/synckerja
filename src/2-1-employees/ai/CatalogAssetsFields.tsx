import { useEffect, useState } from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useToast } from "@/shared/hooks/use-toast";
import { useStorageSignedImageUrl } from "@/shared/hooks/useStorageSignedImageUrl";
import { fontsForRole, googleFontsHref, normalizeBrandFont, previewStack } from "./brandFonts";
import { normalizeDefaultContact, normalizeWebsiteUrl } from "./brandLockupContact";
import { brandHashtagsLabel, brandHashtagsValid, normalizeBrandHashtags } from "./brandLockupHashtags";
import type { CatalogBrandColor, CatalogCompanyLogo } from "./types";

type ColorDraft = {
  id: string | null;
  primary: string;
  secondary: string;
  accent: string;
};

const assetTableScroll =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain-xy min-w-0 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Shared column widths so color + logo Aktif toggles share one vertical line. */
const assetTableClass = "w-full table-fixed";
function AssetColGroup({ canEdit }: { canEdit: boolean }) {
  return (
    <colgroup>
      <col className="w-[22%]" />
      <col className="w-[22%]" />
      <col className="w-[22%]" />
      <col className="w-[18%]" />
      {canEdit ? <col className="w-12" /> : null}
    </colgroup>
  );
}

const emptyColor = (): ColorDraft => ({
  id: null,
  primary: "",
  secondary: "",
  accent: "",
});

function hexOrBlack(value: string): string {
  const body = value.replace(/^#/, "").slice(0, 6);
  return /^[0-9A-Fa-f]{6}$/.test(body) ? `#${body}` : "#000000";
}

function storedHex(value: string): string {
  const body = value.trim().replace(/^#/, "");
  return /^[0-9A-Fa-f]{6}$/.test(body) ? `#${body.toLowerCase()}` : "";
}

function HexCell({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {label ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      ) : null}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={hexOrBlack(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label ? `${label} color` : "Color"}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#000000"
          className="h-8 min-w-0 flex-1 border-gray-300 bg-white font-mono text-xs"
        />
      </div>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: hex || "#ccc" }} />
      <span className="font-mono text-xs text-gray-700">{hex || "—"}</span>
    </span>
  );
}

function ActionMenu({
  label,
  disabled,
  items,
}: {
  label: string;
  disabled?: boolean;
  items: Array<{ label: string; danger?: boolean; onSelect: () => void }>;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={label}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            className={item.danger ? "text-red-600 focus:text-red-600" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              item.onSelect();
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActiveSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      aria-label={checked ? "Aktif" : "Tidak aktif"}
      onClick={(event) => event.stopPropagation()}
      onCheckedChange={onChange}
    />
  );
}

function failureText(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("23505") || message.includes("duplicate")) return "Sudah ada satu untuk katalog ini.";
  if (message.includes("invalid_input") || message.includes("22023")) return "Periksa isiannya.";
  if (message.includes("not_found")) return "File logo belum tersimpan.";
  if (message.includes("forbidden")) return "Hanya pemilik yang bisa mengubah.";
  return "Coba lagi.";
}

export function CatalogColorField({
  blocked,
  canEdit,
  colors,
  selectedId,
  onSave,
  onSelect,
  onDelete,
}: {
  blocked: string | null;
  canEdit: boolean;
  colors: CatalogBrandColor[];
  selectedId: string | null;
  onSave: (input: { id: string | null; primary: string; secondary: string; accent: string }) => Promise<void>;
  onSelect: (id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<ColorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (draft?.id && !colors.some((item) => item.id === draft.id)) setDraft(null);
  }, [colors, draft?.id]);
  if (blocked) return <p className="text-sm text-gray-500">{blocked}</p>;

  const save = async () => {
    if (!draft) return;
    const primary = storedHex(draft.primary);
    const secondary = storedHex(draft.secondary);
    const accent = storedHex(draft.accent);
    if (!primary || !secondary || !accent) {
      toast({ title: "Isi primary, secondary, dan accent.", variant: "destructive" });
      return;
    }
    if (!draft.id && colors.length >= 1) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      await onSave({ id: draft.id, primary, secondary, accent });
      setDraft(null);
      toast({ title: "Warna tersimpan" });
    } catch (error) {
      toast({ title: "Warna tidak tersimpan", description: failureText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns = canEdit ? 5 : 4;
  const setActive = (id: string, checked: boolean) => {
    void onSelect(checked ? id : null).catch((error) => toast({ title: "Warna tidak diubah", description: failureText(error), variant: "destructive" }));
  };

  if (draft) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HexCell
            label="Primary"
            value={draft.primary}
            onChange={(primary) => setDraft((current) => current ? { ...current, primary } : current)}
          />
          <HexCell
            label="Secondary"
            value={draft.secondary}
            onChange={(secondary) => setDraft((current) => current ? { ...current, secondary } : current)}
          />
          <HexCell
            label="Accent"
            value={draft.accent}
            onChange={(accent) => setDraft((current) => current ? { ...current, accent } : current)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          {draft.id ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Aktif</span>
              <ActiveSwitch
                checked={selectedId === draft.id}
                disabled={!canEdit || saving}
                onChange={(checked) => setActive(draft.id as string, checked)}
              />
            </div>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDraft(null)} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" className="h-8 shrink-0 px-3" onClick={() => void save()} disabled={saving}>
              <Check className="mr-1 h-4 w-4" />
              Simpan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Table containerClassName={assetTableScroll} className={assetTableClass}>
      <AssetColGroup canEdit={canEdit} />
      <TableHeader>
        <TableRow>
          <TableHead className="h-6 px-2 py-0 text-[11px] font-medium">Primary</TableHead>
          <TableHead className="h-6 px-2 py-0 text-[11px] font-medium">Secondary</TableHead>
          <TableHead className="h-6 px-2 py-0 text-[11px] font-medium">Accent</TableHead>
          <TableHead className="h-6 px-2 py-0 text-[11px] font-medium">Aktif</TableHead>
          {canEdit ? (
            <TableHead className="h-6 w-12 px-2 py-0 text-right">
              {colors.length === 0 ? (
                <ActionMenu label="Aksi warna" disabled={false} items={[{ label: "Tambah", onSelect: () => setDraft(emptyColor()) }]} />
              ) : null}
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {colors.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns} className="text-sm text-gray-500">Belum ada warna.</TableCell>
          </TableRow>
        ) : colors.map((color) => (
          <TableRow key={color.id} data-state={selectedId === color.id ? "selected" : undefined}>
            <TableCell className="py-1.5"><Swatch hex={color.primary} /></TableCell>
            <TableCell className="py-1.5"><Swatch hex={color.secondary} /></TableCell>
            <TableCell className="py-1.5"><Swatch hex={color.accent} /></TableCell>
            <TableCell className="py-1.5">
              <ActiveSwitch checked={selectedId === color.id} disabled={!canEdit} onChange={(checked) => setActive(color.id, checked)} />
            </TableCell>
            {canEdit ? (
              <TableCell className="py-1.5 text-right">
                <ActionMenu
                  label="Aksi warna"
                  items={[
                    { label: "Ubah", onSelect: () => setDraft({ id: color.id, primary: color.primary, secondary: color.secondary, accent: color.accent }) },
                    {
                      label: "Hapus",
                      danger: true,
                      onSelect: () => {
                        if (!window.confirm("Hapus warna ini?")) return;
                        void onDelete(color.id).catch((error) => toast({ title: "Warna tidak terhapus", description: failureText(error), variant: "destructive" }));
                      },
                    },
                  ]}
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LogoThumb({ path }: { path: string }) {
  const safePath = path.trim();
  const { data: url } = useStorageSignedImageUrl({
    bucket: "digital-asset-company-logos",
    path: safePath || undefined,
  });
  if (!safePath || !url) return <span className="h-14 w-14 flex-shrink-0 rounded border border-gray-300 bg-white" />;
  return <img src={url} alt="" className="h-14 w-14 flex-shrink-0 rounded border border-gray-300 bg-white object-contain" />;
}

export function CatalogLogoField({
  blocked,
  canEdit,
  brandName,
  logos,
  selectedId,
  onSave,
  onSelect,
  onDelete,
}: {
  blocked: string | null;
  canEdit: boolean;
  brandName: string;
  logos: CatalogCompanyLogo[];
  selectedId: string | null;
  onSave: (input: {
    id: string | null;
    file: File | null;
    tagline: string;
    headlineFont: string;
    bodyFont: string;
    websiteUrl: string;
    defaultContact: string;
    hashtags: string[];
  }) => Promise<void>;
  onSelect: (id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tagline, setTagline] = useState("");
  const [headlineFont, setHeadlineFont] = useState("");
  const [bodyFont, setBodyFont] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [defaultContact, setDefaultContact] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const brand = brandName.trim() || "—";
  const fontPreviewHref = googleFontsHref([headlineFont, bodyFont]);
  useEffect(() => {
    if (editingId && !logos.some((item) => item.id === editingId)) {
      setEditingId(null);
      setFile(null);
      setTagline("");
      setHeadlineFont("");
      setBodyFont("");
      setWebsiteUrl("");
      setDefaultContact("");
      setHashtagsText("");
    }
  }, [editingId, logos]);
  useEffect(() => {
    if (!fontPreviewHref || typeof document === "undefined") return;
    const id = "ai-employee-brand-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = fontPreviewHref;
  }, [fontPreviewHref]);
  if (blocked) return <p className="text-sm text-gray-500">{blocked}</p>;

  const reset = () => {
    setEditingId(null);
    setCreating(false);
    setFile(null);
    setTagline("");
    setHeadlineFont("");
    setBodyFont("");
    setWebsiteUrl("");
    setDefaultContact("");
    setHashtagsText("");
    setFileKey((current) => current + 1);
  };
  const beginCreate = () => {
    setEditingId(null);
    setFile(null);
    setTagline("");
    setHeadlineFont("");
    setBodyFont("");
    setWebsiteUrl("");
    setDefaultContact("");
    setHashtagsText("");
    setFileKey((current) => current + 1);
    setCreating(true);
  };
  const beginEdit = (logo: CatalogCompanyLogo) => {
    setCreating(false);
    setEditingId(logo.id);
    setFile(null);
    setTagline(logo.tagline);
    setHeadlineFont(normalizeBrandFont(logo.headlineFont));
    setBodyFont(normalizeBrandFont(logo.bodyFont));
    setWebsiteUrl(logo.websiteUrl);
    setDefaultContact(logo.defaultContact);
    setHashtagsText(brandHashtagsLabel(logo.hashtags ?? []));
    setFileKey((current) => current + 1);
  };
  const save = async (id: string | null) => {
    if (!id && logos.length >= 1) return;
    if (!id && !file) {
      toast({ title: "Pilih file logo.", variant: "destructive" });
      return;
    }
    const website = normalizeWebsiteUrl(websiteUrl);
    const contact = normalizeDefaultContact(defaultContact);
    const hashtags = normalizeBrandHashtags(hashtagsText);
    if (websiteUrl.trim() && !website) {
      toast({ title: "Website tidak valid", description: "Gunakan domain atau URL https://…", variant: "destructive" });
      return;
    }
    if (defaultContact.trim() && !contact) {
      toast({ title: "Kontak tidak valid", description: "Gunakan nomor HP, wa.me/…, atau URL.", variant: "destructive" });
      return;
    }
    if (!brandHashtagsValid(hashtags, hashtagsText)) {
      toast({
        title: "Hashtag tidak valid",
        description: "Gunakan #HurufAngka (spasi antar tag), atau kosongkan.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id,
        file,
        tagline: tagline.trim().slice(0, 120),
        headlineFont: normalizeBrandFont(headlineFont),
        bodyFont: normalizeBrandFont(bodyFont),
        websiteUrl: website,
        defaultContact: contact,
        hashtags,
      });
      reset();
      toast({ title: "Logo tersimpan" });
    } catch (error) {
      toast({ title: "Logo tidak tersimpan", description: failureText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const setActive = (id: string, checked: boolean) => {
    void onSelect(checked ? id : null).catch((error) => toast({ title: "Logo tidak diubah", description: failureText(error), variant: "destructive" }));
  };
  const fontSelectClass =
    "mt-1 flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50";
  const editorCard = (id: string | null) => (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {id ? <LogoThumb path={logos.find((item) => item.id === id)?.logoPath ?? ""} /> : (
            <span className="text-[10px] text-gray-400">Preview</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Brand</p>
            <p className="truncate text-sm font-semibold text-gray-900" title={brand}>{brand}</p>
            <p className="text-xs text-gray-500">Mengikuti nama katalog yang dipilih.</p>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-tagline">
              Tagline
            </label>
            <Input
              id="catalog-logo-tagline"
              value={tagline}
              maxLength={120}
              disabled={!canEdit || saving}
              onChange={(event) => setTagline(event.target.value.slice(0, 120))}
              placeholder="Mis. Rasa yang bikin kangen"
              className="mt-1 h-8 border-gray-300 bg-white text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-headline-font">
                Headline font
              </label>
              <select
                id="catalog-logo-headline-font"
                value={headlineFont}
                disabled={!canEdit || saving}
                onChange={(event) => setHeadlineFont(event.target.value)}
                className={fontSelectClass}
              >
                <option value="">Default Canva</option>
                {fontsForRole("headline").map((font) => (
                  <option key={font.canvaName} value={font.canvaName}>{font.canvaName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-body-font">
                Deskripsi font
              </label>
              <select
                id="catalog-logo-body-font"
                value={bodyFont}
                disabled={!canEdit || saving}
                onChange={(event) => setBodyFont(event.target.value)}
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
              style={{ fontFamily: previewStack(headlineFont) }}
            >
              Headline contoh
            </p>
            <p
              className="mt-1 text-[13px] leading-snug text-gray-600"
              style={{ fontFamily: previewStack(bodyFont) }}
            >
              Deskripsi pendukung memakai font body di seluruh slide.
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              {[headlineFont || "Default", bodyFont || "Default"].join(" · ")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-website">
                Website
              </label>
              <Input
                id="catalog-logo-website"
                value={websiteUrl}
                maxLength={200}
                disabled={!canEdit || saving}
                onChange={(event) => setWebsiteUrl(event.target.value.slice(0, 200))}
                placeholder="https://contoh.com"
                className="mt-1 h-8 border-gray-300 bg-white text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-contact">
                Kontak default
              </label>
              <Input
                id="catalog-logo-contact"
                value={defaultContact}
                maxLength={80}
                disabled={!canEdit || saving}
                onChange={(event) => setDefaultContact(event.target.value.slice(0, 80))}
                placeholder="0812… atau wa.me/62…"
                className="mt-1 h-8 border-gray-300 bg-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500" htmlFor="catalog-logo-hashtags">
              Hashtag caption
            </label>
            <Input
              id="catalog-logo-hashtags"
              value={hashtagsText}
              maxLength={500}
              disabled={!canEdit || saving}
              onChange={(event) => setHashtagsText(event.target.value.slice(0, 500))}
              placeholder="#LaporanBisnis #AnalisisWhatIf #SynckerjaOffice"
              className="mt-1 h-8 border-gray-300 bg-white text-sm"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Logo</p>
            <input
              key={fileKey}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-1 block w-full text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
            <p className="mt-1 text-xs text-gray-500">
              {file ? file.name : id ? "Kosongkan untuk mempertahankan logo ini." : "Pilih file logo."}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        {id ? (
          <ActiveSwitch
            checked={selectedId === id}
            disabled={!canEdit || saving}
            onChange={(checked) => setActive(id, checked)}
          />
        ) : <span />}
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={reset}>
            <X className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" className="h-8 shrink-0 px-2" onClick={() => void save(id)} disabled={saving}>
            <Check className="mr-1 h-4 w-4" />
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );

  if (creating) return editorCard(null);
  if (editingId) return editorCard(editingId);

  return (
    <Table containerClassName={assetTableScroll} className={assetTableClass}>
      <AssetColGroup canEdit={canEdit} />
      <TableBody>
        {logos.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-sm text-gray-500">
              Belum ada logo.
            </TableCell>
            <TableCell />
            {canEdit ? (
              <TableCell className="text-right">
                <ActionMenu
                  label="Aksi logo"
                  disabled={creating || editingId !== null}
                  items={[{ label: "Tambah", onSelect: beginCreate }]}
                />
              </TableCell>
            ) : null}
          </TableRow>
        ) : logos.map((logo) => {
          const metaLabel = [
            [logo.headlineFont, logo.bodyFont].filter(Boolean).join(" · "),
            logo.websiteUrl,
            logo.defaultContact,
            brandHashtagsLabel(logo.hashtags ?? []),
          ].filter(Boolean).join(" · ");
          return (
          <TableRow key={logo.id} data-state={selectedId === logo.id ? "selected" : undefined}>
            <TableCell colSpan={3}>
              <div className="flex min-w-0 items-center gap-2">
                <LogoThumb path={logo.logoPath} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900" title={brand}>{brand}</p>
                  <p className="truncate text-xs text-gray-600" title={logo.tagline || undefined}>
                    {logo.tagline || "Belum ada tagline"}
                  </p>
                  {metaLabel ? (
                    <p className="truncate text-[11px] text-gray-500" title={metaLabel}>{metaLabel}</p>
                  ) : null}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <ActiveSwitch
                checked={selectedId === logo.id}
                disabled={!canEdit}
                onChange={(checked) => setActive(logo.id, checked)}
              />
            </TableCell>
            {canEdit ? (
              <TableCell className="text-right">
                <ActionMenu
                  label="Aksi logo"
                  items={[
                    { label: "Ubah", onSelect: () => beginEdit(logo) },
                    {
                      label: "Hapus",
                      danger: true,
                      onSelect: () => {
                        if (!window.confirm("Hapus logo ini?")) return;
                        void onDelete(logo.id).catch((error) => toast({ title: "Logo tidak terhapus", description: failureText(error), variant: "destructive" }));
                      },
                    },
                  ]}
                />
              </TableCell>
            ) : null}
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
