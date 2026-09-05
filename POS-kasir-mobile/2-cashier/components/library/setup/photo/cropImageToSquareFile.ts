/** Output edge length for catalog product square photos. */
export const CREATE_ITEM_PHOTO_SIZE_PX = 1024;

export type SquareCropTransform = {
  /** Extra zoom beyond cover (1 = exact cover). */
  zoom: number;
  /** Pan in viewport pixels (positive = image moves right/down). */
  offsetX: number;
  offsetY: number;
};

export function coverScale(imageWidth: number, imageHeight: number, viewport: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || viewport <= 0) return 1;
  return Math.max(viewport / imageWidth, viewport / imageHeight);
}

export function clampSquareCropOffset(
  imageWidth: number,
  imageHeight: number,
  viewport: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } {
  const scale = coverScale(imageWidth, imageHeight, viewport) * Math.max(1, zoom);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;
  const minX = viewport - drawW;
  const maxX = 0;
  const minY = viewport - drawH;
  const maxY = 0;
  return {
    offsetX: Math.min(maxX, Math.max(minX, offsetX)),
    offsetY: Math.min(maxY, Math.max(minY, offsetY)),
  };
}

/**
 * Rasterize the visible square viewport (cover + pan/zoom) into a JPEG File.
 */
export async function cropImageToSquareFile(args: {
  imageUrl: string;
  viewportPx: number;
  transform: SquareCropTransform;
  outputSize?: number;
  fileName?: string;
}): Promise<File> {
  const outputSize = args.outputSize ?? CREATE_ITEM_PHOTO_SIZE_PX;
  const img = await loadHtmlImage(args.imageUrl);
  const viewport = Math.max(1, args.viewportPx);
  const zoom = Math.max(1, args.transform.zoom);
  const scale = coverScale(img.naturalWidth, img.naturalHeight, viewport) * zoom;
  const clamped = clampSquareCropOffset(
    img.naturalWidth,
    img.naturalHeight,
    viewport,
    zoom,
    args.transform.offsetX,
    args.transform.offsetY,
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const ratio = outputSize / viewport;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(
    img,
    clamped.offsetX * ratio,
    clamped.offsetY * ratio,
    img.naturalWidth * scale * ratio,
    img.naturalHeight * scale * ratio,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.9,
    );
  });
  return new File([blob], args.fileName ?? `item_${Date.now()}.jpg`, { type: "image/jpeg" });
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}
