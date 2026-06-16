import { useState } from "react";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";

type TrafficWebIdSelectProps = {
  value: string;
  options: string[];
  loading?: boolean;
  disabled?: boolean;
  canDisconnect?: boolean;
  disconnectingWebId?: string | null;
  onValueChange: (webId: string) => void;
  onConnectClick: () => void;
  onDisconnectClick: (webId: string) => void;
};

export function TrafficWebIdSelect({
  value,
  options,
  loading = false,
  disabled = false,
  canDisconnect = false,
  disconnectingWebId = null,
  onValueChange,
  onConnectClick,
  onDisconnectClick,
}: TrafficWebIdSelectProps) {
  const [open, setOpen] = useState(false);

  const triggerLabel = loading
    ? "Memuat…"
    : options.length === 0
      ? "Connect web_id"
      : value.trim() || options[0] || "Connect web_id";

  function handleSelect(webId: string) {
    onValueChange(webId);
    setOpen(false);
  }

  function handleConnect() {
    setOpen(false);
    onConnectClick();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          className="h-8 min-w-[10rem] max-w-[14rem] justify-between gap-1 px-2 text-xs font-normal"
          aria-label="web_id"
        >
          <span className="truncate">{triggerLabel}</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-50 w-[min(18rem,calc(100vw-2rem))] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {options.length === 0 ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs hover:bg-accent"
            onClick={handleConnect}
          >
            <Plus className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Connect web_id
          </button>
        ) : (
          <ul className="flex flex-col gap-0.5" role="listbox" aria-label="web_id">
            {options.map((id) => {
              const selected = value === id || (!value.trim() && id === options[0]);
              const isDisconnecting = disconnectingWebId === id;
              return (
                <li key={id} className="flex min-w-0 items-stretch gap-0.5">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex min-w-0 flex-1 items-center rounded-sm px-2 py-2 text-left text-xs hover:bg-accent",
                      selected && "bg-accent/70 font-medium",
                    )}
                    onClick={() => handleSelect(id)}
                  >
                    <span className="truncate">{id}</span>
                  </button>
                  {canDisconnect ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center justify-center rounded-sm px-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label={`Disconnect web_id ${id}`}
                      title="Disconnect web_id"
                      disabled={isDisconnecting}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpen(false);
                        onDisconnectClick(id);
                      }}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </li>
              );
            })}
            <li className="mt-0.5 border-t border-border pt-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={handleConnect}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 opacity-70" />
                Connect web_id
              </button>
            </li>
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
