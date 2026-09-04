/**
 * Generate Synckerja POS Android launcher + brand drawables from
 * `public/synckerjapos.png` → `android-pos/`.
 *
 * Usage: node scripts/generate-synckerja-pos-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "synckerjapos.png");
const resRoot = path.join(root, "android-pos", "app", "src", "main", "res");

/** Legacy launcher / round sizes (px). */
const LAUNCHER = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

/** Adaptive-icon foreground canvas (px). */
const FOREGROUND = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

async function fitOnCanvas(inputBuf, size, { padRatio = 0.12, bg = { r: 255, g: 255, b: 255, alpha: 1 } } = {}) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(inputBuf)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(srcLogo)) {
    throw new Error(`Missing source logo: ${srcLogo}`);
  }

  const raw = fs.readFileSync(srcLogo);
  console.log(`Source: ${srcLogo}`);

  // Brand drawable (notifications, adaptive inset) — putih agar kontras di UI sistem.
  const brand512 = await fitOnCanvas(raw, 512, {
    padRatio: 0.08,
    bg: { r: 255, g: 255, b: 255, alpha: 1 },
  });
  const brandPath = path.join(resRoot, "drawable", "app_brand_logo.png");
  fs.writeFileSync(brandPath, brand512);
  console.log(`Wrote ${path.relative(root, brandPath)}`);

  // Splash logo: transparan, hampir penuh canvas (tanpa kotak/wrapper putih).
  const splashLogo512 = await fitOnCanvas(raw, 512, {
    padRatio: 0.02,
    bg: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const splashLogoPath = path.join(resRoot, "drawable", "splash_logo.png");
  fs.writeFileSync(splashLogoPath, splashLogo512);
  console.log(`Wrote ${path.relative(root, splashLogoPath)}`);

  // Transparent foreground for adaptive icon (system masks to circle/squircle).
  for (const [density, size] of Object.entries(FOREGROUND)) {
    const buf = await fitOnCanvas(raw, size, {
      padRatio: 0.18,
      bg: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const dir = path.join(resRoot, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "ic_launcher_foreground.png");
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${path.relative(root, out)}`);
  }

  // Legacy full icons (white background).
  for (const [density, size] of Object.entries(LAUNCHER)) {
    const buf = await fitOnCanvas(raw, size, {
      padRatio: 0.1,
      bg: { r: 255, g: 255, b: 255, alpha: 1 },
    });
    const dir = path.join(resRoot, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      const out = path.join(dir, name);
      fs.writeFileSync(out, buf);
      console.log(`Wrote ${path.relative(root, out)}`);
    }
  }

  // Capacitor SplashScreen plugin drawables (after system cold-start theme).
  // Background #f5f5f5 matches `splash_screen_background` / capacitor.config.pos.ts.
  const splashBg = { r: 245, g: 245, b: 245, alpha: 1 };
  const CAPACITOR_SPLASH = {
    "drawable-port-mdpi": [320, 480],
    "drawable-port-hdpi": [480, 800],
    "drawable-port-xhdpi": [720, 1280],
    "drawable-port-xxhdpi": [960, 1600],
    "drawable-port-xxxhdpi": [1280, 1920],
    "drawable-land-mdpi": [480, 320],
    "drawable-land-hdpi": [800, 480],
    "drawable-land-xhdpi": [1280, 720],
    "drawable-land-xxhdpi": [1600, 960],
    "drawable-land-xxxhdpi": [1920, 1280],
  };

  for (const [dirName, [w, h]] of Object.entries(CAPACITOR_SPLASH)) {
    const logoSize = Math.round(Math.min(w, h) * 0.72);
    const logo = await sharp(raw)
      .resize(logoSize, logoSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const buf = await sharp({
      create: { width: w, height: h, channels: 4, background: splashBg },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
    const dir = path.join(resRoot, dirName);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "splash.png");
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${path.relative(root, out)}`);
  }

  console.log("Done — Synckerja POS Android icons updated from public/synckerjapos.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
