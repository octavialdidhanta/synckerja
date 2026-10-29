import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  DEFAULT_CONVERSION_LOCATION_DISPLAYS,
  DEFAULT_OBJECTIVE_DISPLAYS,
  DEFAULT_PLACEMENT_DISPLAYS,
  FIELD_SEPARATORS,
  ITEM_SEPARATORS,
  emptyCampaignNameTemplate,
  hasTokenKind,
  makeToken,
  previewCampaignName,
  resolveCampaignName,
  tokenChipLabel,
  type CampaignNameTemplate,
  type CampaignNameToken,
  type CampaignNameContext,
} from "./campaignNameTemplate";

const NO_FOCUS_RING =
  "shadow-none outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const OBJECTIVE_ROWS = Object.entries(DEFAULT_OBJECTIVE_DISPLAYS);
const CONVERSION_LOCATION_ROWS = Object.entries(DEFAULT_CONVERSION_LOCATION_DISPLAYS);
const PLACEMENT_ROWS = Object.entries(DEFAULT_PLACEMENT_DISPLAYS);

function SortableChip({
  token,
  editing,
  onChange,
  onRemove,
}: {
  token: CampaignNameToken;
  editing: boolean;
  onChange: (next: CampaignNameToken) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: token.id,
    disabled: !editing,
  });
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center rounded-md border bg-background text-sm",
        isDragging && "z-20 shadow-sm",
      )}
    >
      {editing ? (
        <button
          type="button"
          className="cursor-grab touch-none px-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <span className="flex items-center gap-1 px-2 py-1.5">
        {token.kind === "text" ? <Type className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        {tokenChipLabel(token)}
      </span>
      {editing ? (
        <>
          {token.kind !== "campaign_id" && token.kind !== "location" && token.kind !== "interest" ? (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="px-1.5 text-muted-foreground hover:text-foreground" aria-label="Edit token">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="z-[90] w-80 p-3" side="bottom">
                <TokenEditor token={token} onChange={onChange} />
                <div className="mt-2 flex justify-end gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" onClick={() => setOpen(false)}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          <button
            type="button"
            className="px-1.5 text-muted-foreground hover:text-destructive"
            aria-label="Remove token"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function TokenEditor({
  token,
  onChange,
}: {
  token: CampaignNameToken;
  onChange: (next: CampaignNameToken) => void;
}) {
  if (token.kind === "text") {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Open text field</p>
        <Input
          value={token.value}
          onChange={(e) => onChange({ ...token, value: e.target.value })}
          className={NO_FOCUS_RING}
        />
      </div>
    );
  }
  if (token.kind === "cbo") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Advantage+ campaign budget</span>
          <span className="text-xs font-normal text-muted-foreground">Display</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-sm">
          <span>CBO on</span>
          <Input
            value={token.onLabel}
            onChange={(e) => onChange({ ...token, onLabel: e.target.value })}
            className={cn("h-8", NO_FOCUS_RING)}
          />
          <span>CBO off</span>
          <Input
            value={token.offLabel}
            onChange={(e) => onChange({ ...token, offLabel: e.target.value })}
            className={cn("h-8", NO_FOCUS_RING)}
          />
        </div>
      </div>
    );
  }
  if (token.kind === "objective" || token.kind === "conversion_location" || token.kind === "placement") {
    const title =
      token.kind === "objective" ? "Objective" : token.kind === "placement" ? "Placement" : "Conversion location";
    const rows =
      token.kind === "objective"
        ? OBJECTIVE_ROWS
        : token.kind === "placement"
          ? PLACEMENT_ROWS
          : CONVERSION_LOCATION_ROWS;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground">Display</span>
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {rows.map(([key, fallback]) => (
            <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-sm">
              <span className="truncate">{fallback}</span>
              <Input
                value={token.displays[key] ?? fallback}
                onChange={(e) =>
                  onChange({ ...token, displays: { ...token.displays, [key]: e.target.value } })
                }
                className={cn("h-8", NO_FOCUS_RING)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (token.kind === "custom") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">Custom field title</p>
        <Input
          value={token.title}
          onChange={(e) => onChange({ ...token, title: e.target.value })}
          className={NO_FOCUS_RING}
        />
        <p className="text-sm font-semibold">Custom options</p>
        {token.options.map((option, index) => (
          <div key={`${token.id}-opt-${index}`} className="flex gap-1">
            <Input
              value={option}
              onChange={(e) => {
                const options = token.options.slice();
                options[index] = e.target.value;
                onChange({ ...token, options, selected: options[index] });
              }}
              className={cn("h-8", NO_FOCUS_RING)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onChange({ ...token, options: token.options.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...token, options: [...token.options, ""] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    );
  }
  return null;
}

export function InterestResearchCampaignNameTemplate({
  template,
  onChange,
  ctx,
  campaignName,
  onCampaignNameChange,
  useTemplate,
  onUseTemplateChange,
  title = "Campaign name",
  fieldId = "ir-campaign-name",
  entityPlural = "campaigns",
  fieldGroup = "campaign",
  onPersist,
}: {
  template: CampaignNameTemplate;
  onChange: (next: CampaignNameTemplate) => void;
  ctx: CampaignNameContext;
  campaignName: string;
  onCampaignNameChange: (value: string) => void;
  useTemplate: boolean;
  onUseTemplateChange: (enabled: boolean) => void;
  title?: string;
  fieldId?: string;
  entityPlural?: string;
  fieldGroup?: "campaign" | "adset";
  onPersist?: (template: CampaignNameTemplate, enabled: boolean, immediate?: boolean) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(template);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const hasTemplate = template.tokens.length > 0;
  const resolved = useMemo(() => previewCampaignName(template, ctx), [template, ctx]);
  const editorPreview = useMemo(() => previewCampaignName(draft, ctx), [draft, ctx]);
  const displayName = useTemplate && hasTemplate ? resolved : campaignName;

  const openEditor = () => {
    setDraft(hasTemplate ? template : emptyCampaignNameTemplate());
    setEditorOpen(true);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = draft.tokens.map((token) => token.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setDraft({ ...draft, tokens: arrayMove(draft.tokens, oldIndex, newIndex) });
  };

  const addToken = (kind: CampaignNameToken["kind"]) => {
    if (kind !== "text" && kind !== "custom" && hasTokenKind(draft, kind)) return;
    setDraft({
      ...draft,
      tokens: [...draft.tokens, makeToken(kind, kind === "text" ? campaignName : undefined)],
    });
  };

  const saveDraft = (next: CampaignNameTemplate) => {
    const withText = hasTokenKind(next, "text")
      ? next
      : { ...next, tokens: [makeToken("text", campaignName), ...next.tokens] };
    onChange(withText);
    onUseTemplateChange(true);
    onCampaignNameChange(previewCampaignName(withText, ctx));
    onPersist?.(withText, true, true);
    setEditorOpen(false);
  };

  const updateToken = (next: CampaignNameToken) => {
    const nextTemplate = {
      ...template,
      tokens: template.tokens.map((row) => (row.id === next.id ? next : row)),
    };
    onChange(nextTemplate);
    onPersist?.(nextTemplate, useTemplate, false);
  };

  const fillableTokens = template.tokens.filter((token) => token.kind === "text" || token.kind === "custom");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId} className="text-sm font-semibold">
          {title}
        </Label>
        {hasTemplate ? (
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span>Template</span>
            <Switch
              checked={useTemplate}
              onCheckedChange={(checked) => {
                const nextTemplate =
                  checked && !hasTokenKind(template, "text")
                    ? { ...template, tokens: [makeToken("text", campaignName), ...template.tokens] }
                    : template;
                if (nextTemplate !== template) onChange(nextTemplate);
                onUseTemplateChange(checked);
                if (checked) onCampaignNameChange(resolved);
                onPersist?.(nextTemplate, checked, true);
              }}
            />
          </label>
        ) : null}
      </div>

      {useTemplate && hasTemplate ? (
        <>
          <p className="break-all text-sm">{displayName || "—"}</p>
          <div className="space-y-3 rounded-md border bg-muted/40 p-3">
            {fillableTokens.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add an open text field in the template to type a name.</p>
            ) : (
              fillableTokens.map((token) => (
                <div key={token.id} className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {token.kind === "custom" ? token.title.trim() || "Custom field" : "Open text field"}
                  </Label>
                  {token.kind === "custom" && token.options.filter((option) => option.trim()).length > 0 ? (
                    <Select
                      value={token.selected || token.options[0]}
                      onValueChange={(value) => updateToken({ ...token, selected: value })}
                    >
                      <SelectTrigger className={cn("h-10 bg-background", NO_FOCUS_RING)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[90]" position="popper">
                        {token.options.filter((option) => option.trim()).map((option) => (
                          <SelectItem key={option} value={option} indicatorSide="right">
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={token.kind === "text" ? token.value : token.selected || token.title}
                      onChange={(e) =>
                        updateToken(
                          token.kind === "text"
                            ? { ...token, value: e.target.value }
                            : { ...token, selected: e.target.value, title: token.title },
                        )
                      }
                      placeholder="Open text field"
                      className={cn("bg-background text-left", NO_FOCUS_RING)}
                    />
                  )}
                </div>
              ))
            )}
            <button type="button" className="text-sm text-sky-700 hover:underline" onClick={openEditor}>
              Edit template
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={fieldId}
            value={campaignName}
            onChange={(e) => onCampaignNameChange(e.target.value)}
            placeholder={title}
            className={cn("min-w-0 flex-1 text-left", NO_FOCUS_RING)}
          />
          {!hasTemplate ? (
            <Button type="button" variant="outline" className="shrink-0" onClick={openEditor}>
              Create template
            </Button>
          ) : null}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="z-[80] gap-4 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Name your {entityPlural} consistently by creating a template based on your naming convention.
            Names will update automatically to match your current campaign settings.
          </p>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Template</p>
            <div className="min-h-[88px] rounded-md border bg-gradient-to-br from-sky-50/80 to-transparent p-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={draft.tokens.map((token) => token.id)} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {draft.tokens.map((token) => (
                      <SortableChip
                        key={token.id}
                        token={token}
                        editing
                        onChange={(next) =>
                          setDraft({
                            ...draft,
                            tokens: draft.tokens.map((row) => (row.id === next.id ? next : row)),
                          })
                        }
                        onRemove={() =>
                          setDraft({ ...draft, tokens: draft.tokens.filter((row) => row.id !== token.id) })
                        }
                      />
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-8">
                          <Plus className="mr-1 h-4 w-4" />
                          Add component
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-[90] w-64">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {fieldGroup === "adset" ? "Ad set fields" : "Campaign fields"}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="z-[90]">
                            {fieldGroup === "adset" ? (
                              <>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "conversion_location")}
                                  onClick={() => addToken("conversion_location")}
                                >
                                  Conversion location
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "location")}
                                  onClick={() => addToken("location")}
                                >
                                  Location
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "interest")}
                                  onClick={() => addToken("interest")}
                                >
                                  Interest
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "placement")}
                                  onClick={() => addToken("placement")}
                                >
                                  Placement
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem disabled={hasTokenKind(draft, "cbo")} onClick={() => addToken("cbo")}>
                                  Advantage+ campaign budget
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "objective")}
                                  onClick={() => addToken("objective")}
                                >
                                  Objective
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={hasTokenKind(draft, "campaign_id")}
                                  onClick={() => addToken("campaign_id")}
                                >
                                  Campaign ID
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => addToken("text")}>
                          <div>
                            <p>Open text field</p>
                            <p className="text-xs text-muted-foreground">An empty space you can fill in</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addToken("custom")}>
                          <div>
                            <p>Custom field</p>
                            <p className="text-xs text-muted-foreground">Unique info you can add about your ads</p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
          {draft.tokens.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Field separator</Label>
                <Select
                  value={draft.fieldSeparator}
                  onValueChange={(value) => setDraft({ ...draft, fieldSeparator: value })}
                >
                  <SelectTrigger className={cn("h-9", NO_FOCUS_RING)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[90]" position="popper">
                    {FIELD_SEPARATORS.map((sep) => (
                      <SelectItem key={sep} value={sep} indicatorSide="right">
                        {sep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Item separator</Label>
                <Select
                  value={draft.itemSeparator || "__empty__"}
                  onValueChange={(value) =>
                    setDraft({ ...draft, itemSeparator: value === "__empty__" ? "" : value })
                  }
                >
                  <SelectTrigger className={cn("h-9", NO_FOCUS_RING)}>
                    <SelectValue placeholder=" " />
                  </SelectTrigger>
                  <SelectContent className="z-[90]" position="popper">
                    <SelectItem value="__empty__" indicatorSide="right">
                      {" "}
                    </SelectItem>
                    {ITEM_SEPARATORS.filter(Boolean).map((sep) => (
                      <SelectItem key={sep} value={sep} indicatorSide="right">
                        {sep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Preview</p>
                <p className="break-all text-sm text-muted-foreground">{editorPreview || "—"}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={draft.tokens.length === 0} onClick={() => saveDraft(draft)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function campaignNameFromTemplate(template: CampaignNameTemplate, ctx: CampaignNameContext) {
  return resolveCampaignName(template, ctx);
}
