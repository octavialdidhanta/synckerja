import {
  ORDER_COVER_MAX_BYTES,
  ORDER_COVER_MAX_EDGE,
  ORDER_COVER_SOURCE_MAX_BYTES,
  orderCoverOutputSize,
} from "./orderCoverSlides";

const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52] as const;

export class OrderCoverSourceTooLargeError extends Error {
  readonly code = "cover_source_too_large";
}

export class OrderCoverTooHeavyError extends Error {
  readonly code = "cover_too_heavy";
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Shrink a banner to the order-page size and keep the file under 200 KB. */
export async function prepareOrderCoverFile(file: File): Promise<File> {
  if (file.size > ORDER_COVER_SOURCE_MAX_BYTES) throw new OrderCoverSourceTooLargeError();
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (file.type === "image/jpeg" && file.size <= ORDER_COVER_MAX_BYTES && longest <= ORDER_COVER_MAX_EDGE) {
      return file;
    }
    const size = orderCoverOutputSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new OrderCoverTooHeavyError();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    let best: Blob | null = null;
    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasBlob(canvas, quality);
      if (!blob) continue;
      best = blob;
      if (blob.size <= ORDER_COVER_MAX_BYTES) break;
    }
    if (!best || best.size > ORDER_COVER_MAX_BYTES) throw new OrderCoverTooHeavyError();
    const base = file.name.replace(/\.[^.]+$/, "") || "banner";
    return new File([best], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
