function trimNearWhiteCanvas(source: HTMLCanvasElement, padding: number): HTMLCanvasElement | null {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = source;
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 16) continue;
      if (pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + 1 + padding);
  const bottom = Math.min(height, maxY + 1 + padding);
  const trimmed = document.createElement("canvas");
  trimmed.width = Math.max(1, right - left);
  trimmed.height = Math.max(1, bottom - top);
  const next = trimmed.getContext("2d");
  if (!next) return null;
  next.fillStyle = "#ffffff";
  next.fillRect(0, 0, trimmed.width, trimmed.height);
  next.drawImage(source, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("empty-image"));
    }, "image/png");
  });
}

function isTransparent(color: string): boolean {
  return color === "transparent" || color === "rgba(0, 0, 0, 0)";
}

function canvasFont(style: CSSStyleDeclaration): string {
  const family = style.fontFamily || "sans-serif";
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`.replace(/\s+/g, " ").trim();
}

function lengthToPx(token: string, size: number): number {
  const value = token.trim();
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * size;
  return Number.parseFloat(value);
}

function polygonPath(clip: string, width: number, height: number): Path2D | null {
  const match = /^polygon\((.*)\)$/i.exec(clip.trim());
  if (!match) return null;
  const points = match[1].split(",").map((pair) => {
    const [x, y] = pair.trim().split(/\s+/);
    if (!x || !y) return null;
    return [lengthToPx(x, width), lengthToPx(y, height)] as const;
  });
  if (points.length < 3 || points.some((point) => point == null || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) {
    return null;
  }
  const path = new Path2D();
  points.forEach((point, index) => {
    if (!point) return;
    if (index === 0) path.moveTo(point[0], point[1]);
    else path.lineTo(point[0], point[1]);
  });
  path.closePath();
  return path;
}

function isSkippable(style: CSSStyleDeclaration, rect: DOMRect): boolean {
  if (style.display === "none" || style.visibility === "hidden") return true;
  if (Number.parseFloat(style.opacity) === 0) return true;
  if (rect.width <= 1 && rect.height <= 1) return true;
  return style.clip === "rect(0px, 0px, 0px, 0px)";
}

function elementClip(element: Element, style: CSSStyleDeclaration): string {
  if ((element instanceof HTMLElement || element instanceof SVGElement) && element.style.clipPath) {
    return element.style.clipPath;
  }
  return style.clipPath;
}

function paintBackground(
  context: CanvasRenderingContext2D,
  element: Element,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  origin: { x: number; y: number },
) {
  if (isTransparent(style.backgroundColor)) return;
  const clipValue = elementClip(element, style);
  const clip = clipValue && clipValue !== "none" ? polygonPath(clipValue, rect.width, rect.height) : null;
  context.save();
  if (clip) {
    context.translate(rect.left - origin.x, rect.top - origin.y);
    context.clip(clip);
    context.translate(-(rect.left - origin.x), -(rect.top - origin.y));
  }
  context.fillStyle = style.backgroundColor;
  context.fillRect(rect.left - origin.x, rect.top - origin.y, rect.width, rect.height);
  context.restore();
}

function paintText(
  context: CanvasRenderingContext2D,
  element: Element,
  origin: { x: number; y: number },
) {
  const style = getComputedStyle(element);
  if (isTransparent(style.color)) return;
  context.save();
  context.font = canvasFont(style);
  context.fillStyle = style.color;
  context.textBaseline = "top";
  context.textAlign = "left";
  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    range.detach();
    if (rects.length === 0) continue;
    if (rects.length === 1) {
      paintTextLine(context, text, rects[0], style, origin);
      continue;
    }
    let start = 0;
    for (const rect of rects) {
      let end = start;
      while (end < text.length && context.measureText(text.slice(start, end + 1)).width <= rect.width + 2) {
        end += 1;
      }
      if (end === start) end = Math.min(text.length, start + 1);
      const line = text.slice(start, end).trim();
      if (line) paintTextLine(context, line, rect, style, origin);
      start = end;
      while (text[start] === " ") start += 1;
    }
  }
  context.restore();
}

function paintTextLine(
  context: CanvasRenderingContext2D,
  text: string,
  rect: DOMRect,
  style: CSSStyleDeclaration,
  origin: { x: number; y: number },
) {
  const measured = context.measureText(text).width;
  let x = rect.left - origin.x;
  if (rect.width - measured > 8) {
    if (style.textAlign === "center") x += (rect.width - measured) / 2;
    else if (style.textAlign === "right" || style.textAlign === "end") x += rect.width - measured;
  }
  context.fillText(text, x, rect.top - origin.y);
}

function inlineSvgPaint(original: Element, clone: Element, isRoot = false) {
  if (!isRoot && original instanceof SVGElement && clone instanceof SVGElement) {
    const opacity = Number.parseFloat(getComputedStyle(original).opacity);
    if (Number.isFinite(opacity) && opacity < 1) clone.setAttribute("opacity", String(opacity));
  }
  if (original instanceof SVGElement && clone instanceof SVGElement) {
    const style = getComputedStyle(original);
    if (!isTransparent(style.fill) && style.fill !== "none") clone.setAttribute("fill", style.fill);
    if (!isTransparent(style.stroke) && style.stroke !== "none") {
      clone.setAttribute("stroke", style.stroke);
      clone.setAttribute("stroke-width", style.strokeWidth);
      clone.setAttribute("stroke-linecap", style.strokeLinecap);
      clone.setAttribute("stroke-linejoin", style.strokeLinejoin);
    }
  }
  const originals = [...original.children];
  const clones = [...clone.children];
  originals.forEach((child, index) => {
    const next = clones[index];
    if (next) inlineSvgPaint(child, next, false);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("svg-image"));
    image.src = src;
  });
}

async function renderSvg(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  const rect = svg.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const clone = svg.cloneNode(true);
  if (!(clone instanceof SVGSVGElement)) return null;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  inlineSvgPaint(svg, clone, true);
  const xml = new XMLSerializer().serializeToString(clone);
  try {
    return await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  } catch {
    return null;
  }
}

async function collectSvgImages(root: HTMLElement): Promise<Map<SVGSVGElement, HTMLImageElement>> {
  const svgs = [...root.querySelectorAll("svg")].filter((svg) => svg.parentElement?.closest("svg") == null);
  const rendered = await Promise.all(svgs.map(async (svg) => [svg, await renderSvg(svg)] as const));
  const images = new Map<SVGSVGElement, HTMLImageElement>();
  for (const [svg, image] of rendered) {
    if (image) images.set(svg, image);
  }
  return images;
}

function paintElement(
  context: CanvasRenderingContext2D,
  element: Element,
  origin: { x: number; y: number },
  svgImages: Map<SVGSVGElement, HTMLImageElement>,
  defer: Element[],
) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (isSkippable(style, rect)) return;
  const zIndex = style.zIndex;
  if (zIndex !== "auto" && Number(zIndex) > 0 && !defer.includes(element)) {
    defer.push(element);
    return;
  }

  context.save();
  const opacity = Number.parseFloat(style.opacity);
  if (Number.isFinite(opacity) && opacity < 1) context.globalAlpha *= opacity;
  paintBackground(context, element, style, rect, origin);

  if (element instanceof SVGSVGElement) {
    const image = svgImages.get(element);
    if (image) {
      context.drawImage(image, rect.left - origin.x, rect.top - origin.y, rect.width, rect.height);
    }
    context.restore();
    return;
  }

  for (const child of element.children) paintElement(context, child, origin, svgImages, defer);
  paintText(context, element, origin);
  context.restore();
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const svgImages = await collectSvgImages(element);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("empty-image");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const origin = { x: rect.left, y: rect.top };
  const defer: Element[] = [];
  paintElement(context, element, origin, svgImages, defer);
  for (const node of defer) paintElement(context, node, origin, svgImages, defer);
  return canvas;
}

/** Copies a DOM node as a PNG so it can be pasted into WhatsApp. */
export function copyElementAsPng(element: HTMLElement): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("clipboard-unavailable"));
  }
  const blobPromise = renderElementToCanvas(element).then(async (canvas) => {
    const trimmed = trimNearWhiteCanvas(canvas, 48);
    if (!trimmed) throw new Error("empty-image");
    return canvasToPng(trimmed);
  });
  return navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}
