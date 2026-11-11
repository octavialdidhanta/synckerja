import { useEffect, useState } from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useToast } from "@/shared/hooks/use-toast";
import { useStorageSignedImageUrl } from "@/shared/hooks/useStorageSignedImageUrl";
import type { CatalogBrandColor, CatalogCompanyLogo } from "./types";

type ColorDraft = {
  id: string | null;
  primary: string;
  secondary: string;
  accent: string;
};

const assetTableScroll =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain-xy min-w-0 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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

function HexCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex w-[9.5rem] shrink-0 items-center gap-1.5">
      <input
        type="color"
        value={hexOrBlack(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#000000"
        className="h-8 w-[6.5rem] shrink-0 border-gray-300 bg-white font-mono text-xs"
      />
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
  const colorCells = (value: ColorDraft) => (
    <>
      <TableCell><HexCell value={value.primary} onChange={(primary) => setDraft((current) => current ? { ...current, primary } : current)} /></TableCell>
      <TableCell><HexCell value={value.secondary} onChange={(secondary) => setDraft((current) => current ? { ...current, secondary } : current)} /></TableCell>
      <TableCell><HexCell value={value.accent} onChange={(accent) => setDraft((current) => current ? { ...current, accent } : current)} /></TableCell>
      <TableCell>
        {value.id ? (
          <ActiveSwitch checked={selectedId === value.id} disabled={!canEdit || saving} onChange={(checked) => setActive(value.id as string, checked)} />
        ) : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDraft(null)}>
            <X className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" className="h-8 shrink-0 px-2" onClick={() => void save()} disabled={saving}>
            <Check className="mr-1 h-4 w-4" />
            Simpan
          </Button>
        </div>
      </TableCell>
    </>
  );
  return (
    <Table containerClassName={assetTableScroll} className="w-max min-w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Primary</TableHead>
          <TableHead>Secondary</TableHead>
          <TableHead>Accent</TableHead>
          <TableHead>Aktif</TableHead>
          {canEdit ? (
            <TableHead className="w-12 text-right">
              {colors.length === 0 ? (
                <ActionMenu label="Aksi warna" disabled={draft !== null} items={[{ label: "Tambah", onSelect: () => setDraft(emptyColor()) }]} />
              ) : null}
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {draft && draft.id === null ? (
          <TableRow>{colorCells(draft)}</TableRow>
        ) : null}
        {colors.length === 0 && !draft ? (
          <TableRow>
            <TableCell colSpan={columns} className="text-sm text-gray-500">Belum ada warna.</TableCell>
          </TableRow>
        ) : colors.map((color) => (
          <TableRow key={color.id} data-state={selectedId === color.id ? "selected" : undefined}>
            {draft?.id === color.id ? colorCells(draft) : (
              <>
                <TableCell><Swatch hex={color.primary} /></TableCell>
                <TableCell><Swatch hex={color.secondary} /></TableCell>
                <TableCell><Swatch hex={color.accent} /></TableCell>
                <TableCell>
                  <ActiveSwitch checked={selectedId === color.id} disabled={!canEdit} onChange={(checked) => setActive(color.id, checked)} />
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
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
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LogoThumb({ path }: { path: string }) {
  const { data: url } = useStorageSignedImageUrl({ bucket: "digital-asset-company-logos", path });
  if (!url) return <span className="h-10 w-10 flex-shrink-0 rounded border border-gray-300 bg-white" />;
  return <img src={url} alt="" className="h-10 w-10 flex-shrink-0 rounded border border-gray-300 bg-white object-contain" />;
}

export function CatalogLogoField({
  blocked,
  canEdit,
  logos,
  selectedId,
  onSave,
  onSelect,
  onDelete,
}: {
  blocked: string | null;
  canEdit: boolean;
  logos: CatalogCompanyLogo[];
  selectedId: string | null;
  onSave: (input: { id: string | null; file: File | null }) => Promise<void>;
  onSelect: (id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (editingId && !logos.some((item) => item.id === editingId)) {
      setEditingId(null);
      setFile(null);
    }
  }, [editingId, logos]);
  if (blocked) return <p className="text-sm text-gray-500">{blocked}</p>;

  const reset = () => {
    setEditingId(null);
    setCreating(false);
    setFile(null);
    setFileKey((current) => current + 1);
  };
  const save = async (id: string | null) => {
    if (!id && logos.length >= 1) return;
    if (!id && !file) {
      toast({ title: "Pilih file logo.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ id, file });
      reset();
      toast({ title: "Logo tersimpan" });
    } catch (error) {
      toast({ title: "Logo tidak tersimpan", description: failureText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const filePicker = (id: string | null) => (
    <>
      <TableCell>
        <input
          key={fileKey}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="block w-full max-w-[220px] text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-gray-500">
          {file ? file.name : id ? "Kosongkan untuk mempertahankan logo ini." : "Pilih file logo."}
        </p>
      </TableCell>
      <TableCell>
        {id ? (
          <ActiveSwitch
            checked={selectedId === id}
            disabled={!canEdit || saving}
            onChange={(checked) => {
              void onSelect(checked ? id : null).catch((error) => toast({ title: "Logo tidak diubah", description: failureText(error), variant: "destructive" }));
            }}
          />
        ) : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={reset}>
            <X className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" className="h-8 shrink-0 px-2" onClick={() => void save(id)} disabled={saving}>
            <Check className="mr-1 h-4 w-4" />
            Simpan
          </Button>
        </div>
      </TableCell>
    </>
  );

  const columns = canEdit ? 3 : 2;
  return (
    <Table containerClassName={assetTableScroll} className="w-max min-w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Logo</TableHead>
          <TableHead>Aktif</TableHead>
          {canEdit ? (
            <TableHead className="w-12 text-right">
              {logos.length === 0 ? (
                <ActionMenu
                  label="Aksi logo"
                  disabled={creating || editingId !== null}
                  items={[{
                    label: "Tambah",
                    onSelect: () => {
                      setEditingId(null);
                      setFile(null);
                      setFileKey((current) => current + 1);
                      setCreating(true);
                    },
                  }]}
                />
              ) : null}
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {creating ? <TableRow>{filePicker(null)}</TableRow> : null}
        {logos.length === 0 && !creating ? (
          <TableRow>
            <TableCell colSpan={columns} className="text-sm text-gray-500">Belum ada logo.</TableCell>
          </TableRow>
        ) : logos.map((logo) => (
          <TableRow key={logo.id} data-state={selectedId === logo.id ? "selected" : undefined}>
            {editingId === logo.id ? filePicker(logo.id) : (
              <>
                <TableCell><LogoThumb path={logo.logoPath} /></TableCell>
                <TableCell>
                  <ActiveSwitch
                    checked={selectedId === logo.id}
                    disabled={!canEdit}
                    onChange={(checked) => {
                      void onSelect(checked ? logo.id : null).catch((error) => toast({ title: "Logo tidak diubah", description: failureText(error), variant: "destructive" }));
                    }}
                  />
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <ActionMenu
                      label="Aksi logo"
                      items={[
                        {
                          label: "Ubah",
                          onSelect: () => {
                            setCreating(false);
                            setEditingId(logo.id);
                            setFile(null);
                            setFileKey((current) => current + 1);
                          },
                        },
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
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
