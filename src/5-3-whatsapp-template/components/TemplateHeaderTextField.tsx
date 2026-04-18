import { useLayoutEffect, useRef } from "react";
import { Info, PlusCircle } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { insertSnippetAtSelection } from "../utils/templateTextEditor";

type PendingCaret = { start: number; end: number } | null;

/** Meta-style text header: single line, counter top-right, + Add variable below (right). */
export function TemplateHeaderTextField({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<PendingCaret>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const p = pendingCaret.current;
    if (!el || !p) return;
    pendingCaret.current = null;
    el.selectionStart = p.start;
    el.selectionEnd = p.end;
    el.focus();
  }, [value]);

  const addVariable = () => {
    const el = ref.current;
    if (!el) return;
    if (/\{\{1\}\}/.test(value)) {
      toast.message("Header teks hanya mendukung satu variabel: {{1}}.");
      return;
    }
    const { next, caret } = insertSnippetAtSelection(value, el.selectionStart, el.selectionEnd, "{{1}}");
    if (next.length > maxLength) return;
    pendingCaret.current = { start: caret, end: caret };
    onChange(next.slice(0, maxLength));
  };

  const len = value.length;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-800">
        Header<span className="font-normal text-muted-foreground"> · Optional</span>
      </Label>
      <div className="relative rounded-md border border-input bg-background shadow-sm">
        <Input
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          maxLength={maxLength}
          placeholder={placeholder}
          className="h-11 border-0 pr-16 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
          {len}/{maxLength}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1.5 pr-0.5">
        <Button type="button" variant="link" className="h-auto gap-1 p-0 text-xs font-medium text-[#1877F2]" onClick={addVariable}>
          <PlusCircle className="h-3.5 w-3.5" />
          Add variable
        </Button>
        <span className="text-muted-foreground" title="Hanya {{1}} untuk header teks.">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
