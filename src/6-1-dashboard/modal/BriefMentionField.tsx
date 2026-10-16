import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import {
  atomicDelete,
  conceptMentions,
  expandToMentions,
  filterMentions,
  insertMention,
  mentionMenuBox,
  mentionQueryAt,
  mentionRanges,
  type ConceptMention,
  type MentionKind,
  type MentionQuery,
  type MentionRange,
} from "@/6-1-dashboard/modal/briefMentions";

const KIND_ORDER: MentionKind[] = ["character", "location", "property"];

function caretViewportPoint(field: HTMLTextAreaElement): { top: number; left: number; line: number } {
  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.left = "0";
  mirror.style.top = "0";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.height = "auto";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  const copied = [
    "boxSizing",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "wordBreak",
    "overflowWrap",
  ] as const;
  for (const key of copied) mirror.style[key] = style[key];
  mirror.style.width = `${field.offsetWidth}px`;
  const caret = field.selectionStart ?? field.value.length;
  mirror.textContent = field.value.slice(0, caret);
  const marker = document.createElement("span");
  marker.textContent = field.value.slice(caret, caret + 1) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const fieldRect = field.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const point = {
    top: fieldRect.top + (markerRect.top - mirrorRect.top) - field.scrollTop,
    left: fieldRect.left + (markerRect.left - mirrorRect.left) - field.scrollLeft,
    line: markerRect.height || Number.parseFloat(style.lineHeight) || 20,
  };
  mirror.remove();
  return point;
}

function renderMentionNodes(value: string, ranges: MentionRange[], keepTrailingLine = false) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) nodes.push(value.slice(cursor, range.start));
    nodes.push(
      <span
        key={`${range.start}:${range.end}`}
        className="box-decoration-clone rounded-[2px] bg-gray-200 px-px -mx-px"
      >
        {value.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  if (keepTrailingLine) nodes.push("\u200b");
  return nodes;
}

export function BriefMentionText({
  value,
  concept,
  className,
}: {
  value: string;
  concept?: BriefConceptDocument | null;
  className?: string;
}) {
  const handles = useMemo(() => conceptMentions(concept).map((item) => item.handle), [concept]);
  const ranges = useMemo(() => mentionRanges(value, handles), [value, handles]);
  return <span className={className}>{renderMentionNodes(value, ranges)}</span>;
}

export function BriefMentionField({
  value,
  onChange,
  concept,
  className,
  minRows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  concept?: BriefConceptDocument | null;
  className?: string;
  minRows?: number;
}) {
  const { t } = useAppTranslation();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const queryRef = useRef<MentionQuery | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const mentions = useMemo(() => conceptMentions(concept), [concept]);
  const handles = useMemo(() => mentions.map((item) => item.handle), [mentions]);
  const ranges = useMemo(() => mentionRanges(value, handles), [value, handles]);
  const visible = useMemo(
    () => (query ? filterMentions(mentions, query.query) : []),
    [mentions, query],
  );

  useEffect(() => {
    const el = fieldRef.current;
    if (!el || pendingCaret.current == null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (document.activeElement !== el) return;
    el.setSelectionRange(caret, caret);
  }, [value]);

  useEffect(() => {
    if (active >= visible.length) setActive(0);
  }, [active, visible.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const field = fieldRef.current;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const caret = caretViewportPoint(field);
      setBox(
        mentionMenuBox({
          caretTop: caret.top,
          caretLeft: caret.left,
          line: caret.line,
          fieldWidth: rect.width,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      );
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, value, visible.length]);

  useEffect(() => {
    if (!open) return;
      const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const refreshQuery = (nextValue: string, caret: number) => {
    const nextQuery = mentionQueryAt(nextValue, caret, mentionRanges(nextValue, handles));
    queryRef.current = nextQuery;
    setQuery(nextQuery);
    setOpen(Boolean(nextQuery));
    setActive(0);
  };

  const closeMenu = () => {
    queryRef.current = null;
    setQuery(null);
    setOpen(false);
  };

  const choose = (item: ConceptMention) => {
    const el = fieldRef.current;
    const live = el?.value ?? value;
    const stored = queryRef.current;
    const caret = el?.selectionStart ?? live.length;
    const fromCaret = mentionQueryAt(live, caret, mentionRanges(live, handles));
    const liveQuery =
      stored && live.slice(stored.start, stored.end).startsWith("@") ? stored : fromCaret;
    if (!liveQuery || liveQuery.end > live.length) return;
    const next = insertMention(live, liveQuery, item.handle);
    queryRef.current = null;
    pendingCaret.current = next.caret;
    onChange(next.text);
    setQuery(null);
    setOpen(false);
  };

  const labels: Record<MentionKind, string> = {
    character: t("briefDialog.mention.character", "Character"),
    location: t("briefDialog.mention.location", "Location"),
    property: t("briefDialog.mention.property", "Property"),
  };

  return (
    <>
      <div className="grid w-full min-w-0">
        <div
          aria-hidden
          className={cn(
            className,
            "pointer-events-none col-start-1 row-start-1 whitespace-pre-wrap border-transparent bg-white text-gray-800",
          )}
        >
          {renderMentionNodes(value, ranges, true)}
        </div>
        <textarea
          ref={fieldRef}
          value={value}
          rows={minRows}
          className={cn(
            className,
            "col-start-1 row-start-1 resize-none overflow-hidden whitespace-pre-wrap bg-transparent text-transparent caret-gray-800 selection:bg-blue-200/50 selection:text-transparent [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        onSelect={() => {
          const el = fieldRef.current;
          if (!el) return;
          const liveRanges = mentionRanges(el.value, handles);
          const next = expandToMentions(el.selectionStart ?? 0, el.selectionEnd ?? 0, liveRanges);
          if (next.start !== el.selectionStart || next.end !== el.selectionEnd) {
            el.setSelectionRange(next.start, next.end);
            return;
          }
          refreshQuery(el.value, el.selectionStart ?? 0);
        }}
        onKeyDown={(event) => {
          const el = fieldRef.current;
          if (!el) return;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? start;
          if (event.key === "Backspace" || event.key === "Delete") {
            const next = atomicDelete(value, start, end, ranges, event.key);
            if (!next) return;
            event.preventDefault();
            pendingCaret.current = next.caret;
            onChange(next.text);
            closeMenu();
            return;
          }
          if (event.key === "Escape") {
            closeMenu();
            return;
          }
          if (open && visible.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")) {
            event.preventDefault();
            if (event.key === "ArrowDown") setActive((current) => (current + 1) % visible.length);
            if (event.key === "ArrowUp") setActive((current) => (current - 1 + visible.length) % visible.length);
            if (event.key === "Enter") choose(visible[active] ?? visible[0]);
            return;
          }
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey && start === end) {
            if (ranges.some((range) => range.start < start && start < range.end)) event.preventDefault();
          }
        }}
        onBeforeInput={(event) => {
          const el = fieldRef.current;
          if (!el) return;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? start;
          if (start !== end) return;
          if (ranges.some((range) => range.start < start && start < range.end)) event.preventDefault();
        }}
        onChange={(event) => {
          const next = event.target.value;
          const caret = event.target.selectionStart ?? next.length;
          pendingCaret.current = caret;
          onChange(next);
          refreshQuery(next, caret);
        }}
        />
      </div>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              data-brief-mention-menu
              className="pointer-events-auto fixed z-[1000000] max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ top: box.top, left: box.left, width: box.width, pointerEvents: "auto" }}
              onMouseDown={(event) => event.preventDefault()}
            >
              {visible.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  {t("briefDialog.mention.empty", "No matching Character, Location, or Property in Concept.")}
                </p>
              ) : (
                KIND_ORDER.map((kind) => {
                  const group = visible.filter((item) => item.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <div key={kind}>
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-gray-500">{labels[kind]}</p>
                      {group.map((item) => {
                        const index = visible.indexOf(item);
                        return (
                          <button
                            key={item.handle}
                            type="button"
                            className={cn(
                              "flex w-full flex-col items-start px-3 py-1.5 text-left",
                              index === active ? "bg-gray-100" : "hover:bg-gray-50",
                            )}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              choose(item);
                            }}
                            onMouseEnter={() => setActive(index)}
                          >
                            <span className="font-medium text-gray-900">{item.handle}</span>
                            {item.description ? (
                              <span className="line-clamp-1 text-xs text-gray-500">{item.description}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
