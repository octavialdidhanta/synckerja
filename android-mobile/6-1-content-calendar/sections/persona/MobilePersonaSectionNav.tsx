export type MobilePersonaPane = "form" | "prompt" | "result";

const PANES: Array<{ id: MobilePersonaPane; label: string }> = [
  { id: "form", label: "Form" },
  { id: "prompt", label: "Prompt" },
  { id: "result", label: "AI Script" },
];

interface MobilePersonaSectionNavProps {
  activePane: MobilePersonaPane;
  onPaneChange: (pane: MobilePersonaPane) => void;
}

export function MobilePersonaSectionNav({ activePane, onPaneChange }: MobilePersonaSectionNavProps) {
  const flushToResult = activePane === "result";

  return (
    <div
      className={`-mx-2 shrink-0 border-t border-border bg-card px-2 py-2 ${
        flushToResult ? "" : "border-b"
      }`}
    >
      <div className="grid grid-cols-3 gap-1">
        {PANES.map((pane) => {
          const isActive = activePane === pane.id;
          return (
            <button
              key={pane.id}
              type="button"
              onClick={() => onPaneChange(pane.id)}
              className={`rounded-[5px] px-1 py-2 text-center text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {pane.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
