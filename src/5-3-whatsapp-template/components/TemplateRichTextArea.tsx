import { useLayoutEffect, useRef } from "react";
import { Smile, Strikethrough as StrikethroughIcon, Code2, PlusCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { insertSnippetAtSelection, nextBodyVariableIndex, wrapSelection } from "../utils/templateTextEditor";

const QUICK_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "✅",
  "❌",
  "⭐",
  "🎉",
  "💯",
  "📌",
  "🙏",
  "💪",
  "✨",
  "📝",
];

type EditorMode = "body" | "header";

type PendingCaret = { start: number; end: number } | null;

export function TemplateRichTextArea({
  id,
  label,
  optional,
  value,
  onChange,
  maxLength,
  mode,
  minRows = 4,
  className,
}: {
  id: string;
  label: string;
  optional?: boolean;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  mode: EditorMode;
  minRows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
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

  const applyChange = (next: string, caretStart: number, caretEnd: number) => {
    const capped = next.slice(0, maxLength);
    let s = caretStart;
    let e = caretEnd;
    if (next.length > maxLength) {
      const delta = next.length - maxLength;
      e = Math.max(0, e - delta);
      s = Math.min(s, e);
    }
    pendingCaret.current = { start: s, end: e };
    onChange(capped);
  };

  const withField = (fn: (el: HTMLTextAreaElement, v: string) => void) => {
    const el = ref.current;
    if (!el) return;
    fn(el, value);
  };

  const insert = (snippet: string) => {
    withField((el, v) => {
      const { next, caret } = insertSnippetAtSelection(v, el.selectionStart, el.selectionEnd, snippet);
      if (next.length > maxLength) return;
      applyChange(next, caret, caret);
    });
  };

  const wrap = (before: string, after: string) => {
    withField((el, v) => {
      const { next, caretStart, caretEnd } = wrapSelection(v, el.selectionStart, el.selectionEnd, before, after);
      if (next.length > maxLength) return;
      applyChange(next, caretStart, caretEnd);
    });
  };

  const onAddVariable = () => {
    withField((el, v) => {
      let snippet: string;
      if (mode === "header") {
        if (/\{\{1\}\}/.test(v)) {
          toast.message("Header teks hanya mendukung satu variabel: {{1}}.");
          return;
        }
        snippet = "{{1}}";
      } else {
        snippet = `{{${nextBodyVariableIndex(v)}}}`;
      }
      const { next, caret } = insertSnippetAtSelection(v, el.selectionStart, el.selectionEnd, snippet);
      if (next.length > maxLength) return;
      applyChange(next, caret, caret);
    });
  };

  const len = value.length;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> · Optional</span> : null}
      </Label>
      <div className="relative overflow-hidden rounded-md border border-input bg-background shadow-sm">
        <span className="pointer-events-none absolute right-3 top-2 z-[1] text-xs tabular-nums text-muted-foreground">
          {len}/{maxLength}
        </span>
        <Textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          rows={minRows}
          maxLength={maxLength}
          className="min-h-0 resize-y rounded-none border-0 pt-8 focus-visible:ring-0 focus-visible:ring-offset-0"
          spellCheck
        />
        <div className="flex flex-wrap items-center gap-0.5 border-t border-border bg-muted/30 px-1.5 py-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Emoji">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="grid grid-cols-8 gap-1">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted"
                    onClick={() => insert(em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 font-serif font-bold" title="Bold (*teks*)" onClick={() => wrap("*", "*")}>
            B
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 italic" title="Italic (_teks_)" onClick={() => wrap("_", "_")}>
            I
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Strikethrough (~teks~)" onClick={() => wrap("~", "~")}>
            <StrikethroughIcon className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Monospace (```teks```)" onClick={() => wrap("```", "```")}>
            <Code2 className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs font-medium" onClick={onAddVariable}>
            <PlusCircle className="h-3.5 w-3.5" />
            Add variable
          </Button>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground" title="Variabel {{1}} dipakai untuk data dinamis. Meta memerlukan contoh isi di langkah berikutnya.">
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
