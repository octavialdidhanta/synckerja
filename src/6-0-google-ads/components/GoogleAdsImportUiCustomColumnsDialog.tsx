import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (names: string[], replaceAll: boolean) => Promise<void>;
  isImporting?: boolean;
};

function parseLines(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function GoogleAdsImportUiCustomColumnsDialog({
  open,
  onOpenChange,
  onImport,
  isImporting,
}: Props) {
  const [text, setText] = useState("");
  const [replaceAll, setReplaceAll] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setText("");
      setReplaceAll(false);
    }
    onOpenChange(next);
  };

  const handleImport = async () => {
    const names = parseLines(text);
    if (names.length === 0) return;
    await onImport(names, replaceAll);
    handleOpenChange(false);
  };

  const lineCount = parseLines(text).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Custom columns dari Google Ads</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Google Ads API tidak menyediakan daftar Custom columns (formula). Salin nama kolom
            dari Google Ads → Modify columns → Custom columns (satu nama per baris), lalu tempel
            di bawah.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ui-custom-column-names">Nama kolom</Label>
            <Textarea
              id="ui-custom-column-names"
              placeholder={`% Page harga To Page Form\nThank You Page\n30 Second timer\n…`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {lineCount > 0 ? `${lineCount} kolom siap diimpor` : "Tempel daftar nama kolom"}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={replaceAll}
              onCheckedChange={(v) => setReplaceAll(v === true)}
              className="mt-0.5"
            />
            <span>
              Ganti semua kolom yang sudah ada untuk akun & tab ini (hapus daftar lama sebelum
              impor)
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={lineCount === 0 || isImporting}
            onClick={() => void handleImport()}
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import {lineCount > 0 ? `(${lineCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
