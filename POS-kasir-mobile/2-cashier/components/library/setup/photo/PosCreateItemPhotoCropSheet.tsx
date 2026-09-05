import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../../../lib/posCashierCopy";
import {
  clampSquareCropOffset,
  coverScale,
  cropImageToSquareFile,
  type SquareCropTransform,
} from "./cropImageToSquareFile";

type Props = {
  open: boolean;
  imageUrl: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const VIEWPORT = 280;

/**
 * Full-screen square crop: drag to adjust position, pinch/zoom buttons for cover zoom.
 * Output is always a square JPEG regardless of camera aspect.
 */
export function PosCreateItemPhotoCropSheet({
  open,
  imageUrl,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState<SquareCropTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [encoding, setEncoding] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !imageUrl) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setNatural({ w, h });
      const scale = coverScale(w, h, VIEWPORT);
      const drawW = w * scale;
      const drawH = h * scale;
      setTransform({
        zoom: 1,
        offsetX: (VIEWPORT - drawW) / 2,
        offsetY: (VIEWPORT - drawH) / 2,
      });
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  if (!open || !imageUrl) return null;

  const scale =
    natural.w > 0
      ? coverScale(natural.w, natural.h, VIEWPORT) * Math.max(1, transform.zoom)
      : 1;
  const drawW = natural.w * scale;
  const drawH = natural.h * scale;

  const applyOffset = (offsetX: number, offsetY: number, zoom = transform.zoom) => {
    if (natural.w <= 0) return;
    setTransform({
      zoom,
      ...clampSquareCropOffset(natural.w, natural.h, VIEWPORT, zoom, offsetX, offsetY),
    });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.offsetX,
      originY: transform.offsetY,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    applyOffset(
      drag.originX + (e.clientX - drag.startX),
      drag.originY + (e.clientY - drag.startY),
    );
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const nudgeZoom = (delta: number) => {
    const nextZoom = Math.min(3, Math.max(1, transform.zoom + delta));
    applyOffset(transform.offsetX, transform.offsetY, nextZoom);
  };

  const handleConfirm = async () => {
    if (!imageUrl || encoding || busy) return;
    setEncoding(true);
    try {
      const file = await cropImageToSquareFile({
        imageUrl,
        viewportPx: VIEWPORT,
        transform,
      });
      onConfirm(file);
    } finally {
      setEncoding(false);
    }
  };

  const blocked = encoding || busy;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/95 text-white">
      <header
        className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2"
        style={{
          paddingTop:
            "max(0.625rem, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
        }}
      >
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3 text-white hover:bg-white/10"
          disabled={blocked}
          onClick={onCancel}
        >
          {t(POS_CASHIER_I18N.setupClose, "Close")}
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {t(POS_CASHIER_I18N.setupPhotoAdjust, "Adjust photo")}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3 font-semibold text-white hover:bg-white/10"
          disabled={blocked || natural.w <= 0}
          onClick={() => void handleConfirm()}
        >
          {t(POS_CASHIER_I18N.setupPhotoUse, "Use")}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-xs text-white/70">
          {t(POS_CASHIER_I18N.setupPhotoDragHint, "Drag to reposition. Output is always square.")}
        </p>
        <div
          className="relative overflow-hidden rounded-2xl bg-slate-800 shadow-lg ring-2 ring-white/40 touch-none"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {natural.w > 0 ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: drawW,
                height: drawH,
                left: transform.offsetX,
                top: transform.offsetY,
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
              …
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full"
            disabled={blocked || transform.zoom <= 1}
            onClick={() => nudgeZoom(-0.15)}
            aria-label={t(POS_CASHIER_I18N.setupPhotoZoomOut, "Zoom out")}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full"
            disabled={blocked || transform.zoom >= 3}
            onClick={() => nudgeZoom(0.15)}
            aria-label={t(POS_CASHIER_I18N.setupPhotoZoomIn, "Zoom in")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="shrink-0 px-4 pt-2"
        style={{
          paddingBottom:
            "max(1rem, env(safe-area-inset-bottom, 0px), var(--footer-bottom-inset, 0px))",
        }}
      />
    </div>
  );
}
