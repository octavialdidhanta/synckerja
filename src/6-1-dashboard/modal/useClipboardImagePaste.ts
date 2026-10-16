import { useEffect, useRef } from "react";

let activePasteId = 0;
let pasteSerial = 0;
let nextPasteId = 1;

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  const listed = Array.from(data.files).find((file) => file.type.startsWith("image/"));
  if (listed) return listed;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (file.type.startsWith("image/")) return file;
    const extension = item.type.split("/")[1] || "png";
    return new File([file], file.name || `pasted.${extension}`, { type: item.type });
  }
  return null;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** The last hovered or focused slot receives Ctrl+V, including a screenshot taken outside the page. */
export function useClipboardImagePaste(enabled: boolean, onImage: (file: File) => void) {
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextPasteId += 1;
  const onImageRef = useRef(onImage);
  onImageRef.current = onImage;

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!enabled || activePasteId !== idRef.current) return;
      if (event.defaultPrevented || isTextField(event.target)) return;
      if (pasteSerial === event.timeStamp) return;
      const file = imageFileFromClipboard(event.clipboardData);
      if (!file) return;
      pasteSerial = event.timeStamp;
      event.preventDefault();
      onImageRef.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("paste", onPaste);
      if (activePasteId === idRef.current) activePasteId = 0;
    };
  }, [enabled]);

  return {
    arm: () => {
      if (enabled) activePasteId = idRef.current;
    },
  };
}
