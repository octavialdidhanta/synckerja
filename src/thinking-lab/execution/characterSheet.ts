import { lookStylePromptBlock } from "@/6-1-dashboard/lib/seedanceVideo";

export function characterDisplayName(handle: string): string {
  const body = handle
    .replace(/^@character_/, "")
    .replace(/^@/, "")
    .replace(/_/g, " ")
    .trim();
  if (!body) return "Character";
  return body.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function characterStorageKey(handle: string): string {
  const key = handle
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return key || "character";
}

export function characterVisualPath(
  organizationId: string,
  executionId: string,
  handle: string,
  kind: "portrait" | "sheet" | "body",
  ext: "jpg" | "png",
): string {
  return `${organizationId}/thinking-lab/${executionId}/${characterStorageKey(handle)}-${kind}.${ext}`;
}

export function buildCharacterPortraitPrompt(name: string, description: string, look?: string): string {
  const subject = description.trim() || name;
  const lookBlock = lookStylePromptBlock(look ?? "");
  return [
    "Create ONE photorealistic studio portrait photograph of a single person.",
    `The person is ${name}. ${subject}`,
    "Frame: head and upper chest, 4:5 portrait, plain seamless light-gray background, sharp focus, looking toward the camera.",
    lookBlock
      ? `${lookBlock} Apply LOOK to camera and grade. Soft cinematic window light is forbidden when LOOK asks for UGC or commercial.`
      : "Use soft even studio light.",
    "Use the expression, age, and clothing implied by the description. If clothing is not described, use simple everyday clothes that fit that person.",
    "One real human, photographed. Skin, hair, and cloth must look like a camera photo.",
    "Forbidden: cartoon, illustration, anime, manga, vector, comic, 3D render, pixar, drawing, sketch, cel shading, stylized character.",
    "No text, no letters, no watermark, no logo, no border, no collage, no character sheet, no extra props.",
  ].join(" ");
}

export function buildCharacterSheetPrompt(name: string, description: string, look?: string): string {
  const subject = description.trim() || "No further description.";
  const lookBlock = lookStylePromptBlock(look ?? "");
  return [
    "The attached photograph is the character. Copy that exact face into every panel.",
    "Match the reference photo: same eyes, nose, mouth, jaw, skin tone, hair, and the exact clothes visible in the photo. A t-shirt stays a t-shirt. Do not invent a different face, a different outfit, or a different age.",
    "Keep the photographic medium of the reference. If the reference is a real person, every panel is a camera photo of that same person. Do not redraw them as a cartoon, illustration, anime, or 3D character.",
    "Create ONE live-action casting lookbook on a solid white canvas, landscape 16:9.",
    "Every person in every panel is a REAL photographed human, not a drawing. Use camera photos: real skin texture, real hair, real fabric, photographic lighting.",
    ...(lookBlock
      ? [lookBlock, "Apply LOOK to camera and grade on every photo panel. Keep the white canvas and layout."]
      : []),
    "FORBIDDEN in every panel: cartoon, illustration, anime, manga, vector, comic, 3D render, pixar, clay, drawing, sketch, cel shading, flat character design, stylized character.",
    "Top-left portrait: the same person and the same shirt as the attached photo, not a new design.",
    "The white background reaches all four edges. Arrange photographs of that one person into the layout below.",
    `HEADER, top left: small label “KARAKTER UTAMA”, then the name spelled exactly “${name}”. Under the name, one short spoken line in the same language as the description. The line may only restate the personality already written. No new fact, no number, no product.`,
    "Under that, three labeled rows: Usia, Sifat, Peran. Fill them only from the description below. If a row is not in the description, write an em dash.",
    "To the right of the header: three head shots of the same person labeled FRONT VIEW, 3/4 VIEW, and PROFILE.",
    "Next band, labeled FULL BODY VIEW: five full-body views of the same outfit labeled FRONT VIEW, 3/4 VIEW, SIDE VIEW, BACK VIEW, and 3/4 BACK VIEW.",
    "Next, a CLOSE UP DETAIL box with four photos labeled MATA, HIDUNG, MULUT, and TELINGA.",
    "Beside it, COLOR PALETTE: six round swatches taken from the skin, hair, and clothes already visible. No extra colors.",
    "Beside that, PROPS: photograph an object only when the description names it. If none is named, show the label PROPS and an em dash. Do not invent bags, drinks, or products.",
    "Bottom band, labeled FACIAL EXPRESSIONS: seven faces of the same person labeled TERSENYUM LEBAR, CUTE / MENGEMUT, BERPIKIR, ANTUSIAS, TERKEJUT, MENGEDIP, and TERSENYUM MANIS.",
    "Keep every label spelled exactly as written here. No watermark.",
    `DESCRIPTION (the only facts you may use): ${subject}`,
  ].join("\n");
}
