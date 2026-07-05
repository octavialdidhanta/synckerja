import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brackets, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";

type VariableTokenPickerProps = {
  onInsert: (token: string) => void;
};

const TOKENS = ["{{contact.first_name}}", "{{contact.full_name}}", "{{last_customer_reply}}"];

export function VariableTokenPicker({ onInsert }: VariableTokenPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOKENS;
    return TOKENS.filter((token) => token.toLowerCase().includes(q));
  }, [query]);

  const handleInsert = (token: string) => {
    onInsert(token);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("omnichannel.automationFlow.editor.variables")}>
          <Brackets className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("omnichannel.automationFlow.editor.variablesTitle")}
          </p>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("omnichannel.automationFlow.editor.variablesSearch")}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto pb-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t("omnichannel.automationFlow.editor.variablesEmpty")}</p>
          ) : (
            filtered.map((token) => (
              <button
                key={token}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => handleInsert(token)}
              >
                {token}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const MESSAGE_MAX_LENGTH = 2000;

export function insertAtCursor(
  value: string,
  token: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; cursor: number } {
  const next = value.slice(0, selectionStart) + token + value.slice(selectionEnd);
  const cursor = selectionStart + token.length;
  return { next, cursor };
}
