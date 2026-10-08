function trimNearWhiteCanvas(source: HTMLCanvasElement, padding: number): HTMLCanvasElement | null {
  const longest = Math.max(source.width, source.height);
  const sampleScale = Math.min(1, 512 / longest);
  const sampleWidth = Math.max(1, Math.round(source.width * sampleScale));
  const sampleHeight = Math.max(1, Math.round(source.height * sampleScale));
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return null;
  sampleContext.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  let pixels: Uint8ClampedArray;
  try {
    pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  } catch {
    return null;
  }

  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      if (pixels[index + 3] < 16) continue;
      if (pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const inv = 1 / sampleScale;
  const left = Math.max(0, Math.floor(minX * inv) - padding);
  const top = Math.max(0, Math.floor(minY * inv) - padding);
  const right = Math.min(source.width, Math.ceil((maxX + 1) * inv) + padding);
  const bottom = Math.min(source.height, Math.ceil((maxY + 1) * inv) + padding);
  const trimmed = document.createElement("canvas");
  trimmed.width = Math.max(1, right - left);
  trimmed.height = Math.max(1, bottom - top);
  const next = trimmed.getContext("2d");
  if (!next) return null;
  next.imageSmoothingEnabled = false;
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

function cssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cornerRadii(style: CSSStyleDeclaration, rect: DOMRect): [number, number, number, number] {
  const radius = (token: string, size: number) => {
    const value = token.trim().split(/\s+/)[0] ?? "0";
    if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * size;
    return cssPx(value);
  };
  const limit = Math.min(rect.width, rect.height) / 2;
  const clamp = (value: number) => Math.max(0, Math.min(limit, value));
  return [
    clamp(radius(style.borderTopLeftRadius, rect.width)),
    clamp(radius(style.borderTopRightRadius, rect.width)),
    clamp(radius(style.borderBottomRightRadius, rect.width)),
    clamp(radius(style.borderBottomLeftRadius, rect.width)),
  ];
}

function traceRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: [number, number, number, number],
) {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii;
  context.beginPath();
  context.moveTo(x + topLeft, y);
  context.arcTo(x + width, y, x + width, y + height, topRight);
  context.arcTo(x + width, y + height, x, y + height, bottomRight);
  context.arcTo(x, y + height, x, y, bottomLeft);
  context.arcTo(x, y, x + width, y, topLeft);
  context.closePath();
}

function deviceBox(
  context: CanvasRenderingContext2D,
  rect: DOMRect,
  origin: { x: number; y: number },
) {
  const scale = context.getTransform().a || 1;
  return {
    scale,
    x: Math.round((rect.left - origin.x) * scale),
    y: Math.round((rect.top - origin.y) * scale),
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale)),
  };
}

type BorderSide = { width: number; style: string; color: string };

function borderSide(style: CSSStyleDeclaration, side: "Top" | "Right" | "Bottom" | "Left"): BorderSide {
  return {
    width: cssPx(style.getPropertyValue(`border-${side.toLowerCase()}-width`)),
    style: style.getPropertyValue(`border-${side.toLowerCase()}-style`),
    color: style.getPropertyValue(`border-${side.toLowerCase()}-color`),
  };
}

function borderVisible(side: BorderSide): boolean {
  return side.width > 0 && side.style !== "none" && side.style !== "hidden" && !isTransparent(side.color);
}

function isCopyExcluded(element: Element): boolean {
  return element instanceof HTMLElement && element.dataset.copyExclude != null;
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

function paintShadow(
  context: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  origin: { x: number; y: number },
) {
  const shadow = style.boxShadow;
  if (!shadow || shadow === "none" || isTransparent(style.backgroundColor)) return;
  const match = /^(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(shadow.trim());
  if (!match) return;
  const offsetX = Number(match[2]);
  const offsetY = Number(match[3]);
  const blur = Number(match[4]);
  if (offsetX === 0 && offsetY === 0 && blur === 0) return;
  const radii = cornerRadii(style, rect);
  context.save();
  context.fillStyle = match[1];
  const x = rect.left - origin.x + offsetX;
  const y = rect.top - origin.y + offsetY + Math.min(blur, 2);
  if (radii.some((radius) => radius > 0)) {
    traceRoundRect(context, x, y, rect.width, rect.height, radii);
    context.fill();
  } else {
    context.fillRect(x, y, rect.width, rect.height);
  }
  context.restore();
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
  const radii = cornerRadii(style, rect);
  if (!clip && radii.some((radius) => radius > 0.5)) {
    const box = deviceBox(context, rect, origin);
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = style.backgroundColor;
    traceRoundRect(
      context,
      box.x,
      box.y,
      box.width,
      box.height,
      radii.map((radius) => radius * box.scale) as [number, number, number, number],
    );
    context.fill();
    context.restore();
    return;
  }
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

function paintBorder(
  context: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  origin: { x: number; y: number },
) {
  const sides = [
    borderSide(style, "Top"),
    borderSide(style, "Right"),
    borderSide(style, "Bottom"),
    borderSide(style, "Left"),
  ];
  if (!sides.some(borderVisible)) return;
  const box = deviceBox(context, rect, origin);
  const uniform =
    sides.every(borderVisible) &&
    sides.every((side) => side.width === sides[0].width && side.style === sides[0].style && side.color === sides[0].color);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.lineJoin = "round";
  context.lineCap = "butt";
  if (uniform) {
    const width = Math.max(1, Math.round(sides[0].width * box.scale));
    const inset = width / 2;
    const radii = cornerRadii(style, rect).map((radius) =>
      Math.max(0, radius * box.scale - inset),
    ) as [number, number, number, number];
    context.beginPath();
    context.strokeStyle = sides[0].color;
    context.lineWidth = width;
    if (sides[0].style === "dashed") context.setLineDash([width * 3, width * 2.2]);
    else if (sides[0].style === "dotted") context.setLineDash([width, width * 1.6]);
    traceRoundRect(context, box.x + inset, box.y + inset, Math.max(1, box.width - width), Math.max(1, box.height - width), radii);
    context.stroke();
  } else {
    const lines: Array<[BorderSide, number, number, number, number]> = [
      [sides[0], box.x, box.y, box.x + box.width, box.y],
      [sides[1], box.x + box.width, box.y, box.x + box.width, box.y + box.height],
      [sides[2], box.x, box.y + box.height, box.x + box.width, box.y + box.height],
      [sides[3], box.x, box.y, box.x, box.y + box.height],
    ];
    lines.forEach(([side, x1, y1, x2, y2], index) => {
      if (!borderVisible(side)) return;
      const width = Math.max(1, Math.round(side.width * box.scale));
      const inset = width / 2;
      const horizontal = index === 0 || index === 2;
      const inward = index === 0 || index === 3 ? inset : -inset;
      context.beginPath();
      context.strokeStyle = side.color;
      context.lineWidth = width;
      context.setLineDash(side.style === "dashed" ? [width * 3, width * 2.2] : side.style === "dotted" ? [width, width * 1.6] : []);
      if (horizontal) {
        context.moveTo(x1, y1 + inward);
        context.lineTo(x2, y2 + inward);
      } else {
        context.moveTo(x1 + inward, y1);
        context.lineTo(x2 + inward, y2);
      }
      context.stroke();
    });
  }
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
  const scale = context.getTransform().a || 1;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  const fontSize = Math.max(1, cssPx(style.fontSize) * scale);
  const family = style.fontFamily || "sans-serif";
  context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${family}`.replace(/\s+/g, " ").trim();
  context.fillStyle = style.color;
  context.textBaseline = "top";
  context.textAlign = "left";
  const measured = context.measureText(text).width;
  let x = (rect.left - origin.x) * scale;
  const box = rect.width * scale;
  if (box - measured > 8 * scale) {
    if (style.textAlign === "center") x += (box - measured) / 2;
    else if (style.textAlign === "right" || style.textAlign === "end") x += box - measured;
  }
  context.fillText(text, Math.round(x), Math.round((rect.top - origin.y) * scale));
  context.restore();
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

async function renderSvg(svg: SVGSVGElement, scale: number): Promise<HTMLImageElement | null> {
  const rect = svg.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const clone = svg.cloneNode(true);
  if (!(clone instanceof SVGSVGElement)) return null;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.max(1, Math.ceil(rect.width * scale))));
  clone.setAttribute("height", String(Math.max(1, Math.ceil(rect.height * scale))));
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

async function collectSvgImages(root: HTMLElement, scale: number): Promise<Map<SVGSVGElement, HTMLImageElement>> {
  const svgs = [...root.querySelectorAll("svg")].filter(
    (svg) => svg.parentElement?.closest("svg") == null && svg.closest("[data-copy-exclude]") == null,
  );
  const rendered = await Promise.all(svgs.map(async (svg) => [svg, await renderSvg(svg, scale)] as const));
  const images = new Map<SVGSVGElement, HTMLImageElement>();
  for (const [svg, image] of rendered) {
    if (image) images.set(svg, image);
  }
  return images;
}

type PaintClock = { at: number };

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function yieldSlice(clock: PaintClock) {
  if (performance.now() - clock.at < 8) return;
  await nextFrame();
  clock.at = performance.now();
}

async function paintElement(
  context: CanvasRenderingContext2D,
  element: Element,
  origin: { x: number; y: number },
  svgImages: Map<SVGSVGElement, HTMLImageElement>,
  defer: Element[],
  clock: PaintClock,
) {
  await yieldSlice(clock);
  if (isCopyExcluded(element)) return;
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
  paintShadow(context, style, rect, origin);
  paintBackground(context, element, style, rect, origin);
  paintBorder(context, style, rect, origin);

  if (element instanceof SVGSVGElement) {
    const image = svgImages.get(element);
    if (image) {
      context.drawImage(image, rect.left - origin.x, rect.top - origin.y, rect.width, rect.height);
    }
    context.restore();
    return;
  }

  for (const child of element.children) await paintElement(context, child, origin, svgImages, defer, clock);
  paintText(context, element, origin);
  context.restore();
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => requestAnimationFrame(() => resolve()), 0);
  });
}

async function renderElementToCanvas(element: HTMLElement): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  if (document.fonts?.ready) await document.fonts.ready;
  await afterNextPaint();
  const rect = element.getBoundingClientRect();
  const pad = 20;
  const width = Math.max(1, Math.ceil(rect.width) + pad * 2);
  const height = Math.max(1, Math.ceil(rect.height) + pad * 2);
  const longest = Math.max(width, height);
  let scale = Math.max(3, Math.ceil(2400 / Math.max(1, rect.width)));
  const maxPixels = 7_000_000;
  while (scale > 3 && (longest * scale > 8192 || width * height * scale * scale > maxPixels)) scale -= 1;
  if (longest * scale > 8192) scale = Math.max(2, Math.floor(8192 / longest));
  const svgImages = await collectSvgImages(element, scale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("empty-image");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const origin = { x: rect.left - pad, y: rect.top - pad };
  const defer: Element[] = [];
  const clock = { at: performance.now() };
  await paintElement(context, element, origin, svgImages, defer, clock);
  for (const node of defer) await paintElement(context, node, origin, svgImages, defer, clock);
  await nextFrame();
  return { canvas, scale };
}

/** Copies a DOM node as a PNG so it can be pasted into WhatsApp. */
export function copyElementAsPng(element: HTMLElement): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("clipboard-unavailable"));
  }
  const blobPromise = renderElementToCanvas(element).then(async ({ canvas, scale }) => {
    const trimmed = trimNearWhiteCanvas(canvas, Math.round(28 * scale));
    if (!trimmed) throw new Error("empty-image");
    return canvasToPng(trimmed);
  });
  return navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}
