/**
 * Generate Synckerja Office Android launcher + brand/splash drawables from
 * `public/synckerjaoffice.png` → `android/`.
 *
 * Sizing matches `scripts/generate-synckerja-pos-icons.mjs` (home screen + splash).
 *
 * Usage: node scripts/generate-synckerja-icons.mjs
 *    or: npm run icons:build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcLogo = path.join(root, "public", "synckerjaoffice.png");
/** Status-bar small icon source (full-color S on black → transparan, tanpa wrapper putih). */
const srcStatusLogo = path.join(root, "public", "pwa-512.png");
const resRoot = path.join(root, "android", "app", "src", "main", "res");

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

/** Status-bar / tray small-icon sizes (px). */
const STATUS_ICON = {
  mdpi: 24,
  hdpi: 36,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
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

/** Turn near-black canvas into transparent (keeps red/blue logo pixels). */
async function blackBackgroundToTransparent(inputBuf, threshold = 42) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Pure/near-black + slightly cool blacks that read as bluish on white wrappers.
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }
  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(srcLogo)) {
    throw new Error(`Missing source logo: ${srcLogo}`);
  }
  if (!fs.existsSync(srcStatusLogo)) {
    throw new Error(`Missing status-bar logo: ${srcStatusLogo}`);
  }

  const raw = fs.readFileSync(srcLogo);
  console.log(`Source: ${srcLogo}`);

  // Strip black only (jangan trim agresif — itu membuat logo home screen terlalu besar).
  const officeLogo = await blackBackgroundToTransparent(raw);
  const whiteBg = { r: 255, g: 255, b: 255, alpha: 1 };
  const clearBg = { r: 0, g: 0, b: 0, alpha: 0 };

  // Brand / home adaptive inset — padRatio 0.08 sama dengan POS (ukuran normal).
  const brand512 = await fitOnCanvas(officeLogo, 512, {
    padRatio: 0.08,
    bg: whiteBg,
  });
  const brandPath = path.join(resRoot, "drawable", "app_brand_logo.png");
  fs.writeFileSync(brandPath, brand512);
  console.log(`Wrote ${path.relative(root, brandPath)}`);

  // Avatar heads-up: trim hanya di sini agar lingkaran notifikasi terisi, bukan home screen.
  const avatarTrimmed = await sharp(officeLogo).trim({ threshold: 12 }).png().toBuffer();
  const avatarInner = Math.round(512 * 0.92);
  const avatarLogo = await sharp(avatarTrimmed)
    .resize(avatarInner, avatarInner, {
      fit: "contain",
      background: clearBg,
    })
    .png()
    .toBuffer();
  const avatar512 = await sharp({
    create: { width: 512, height: 512, channels: 4, background: whiteBg },
  })
    .composite([{ input: avatarLogo, gravity: "center" }])
    .png()
    .toBuffer();
  const avatarPath = path.join(resRoot, "drawable", "ic_notification_avatar.png");
  fs.writeFileSync(avatarPath, avatar512);
  console.log(`Wrote ${path.relative(root, avatarPath)} (Office logo, fill ~92%)`);

  // Status bar small icon: pwa-512, latar transparan; pad kecil = glyph lebih besar di tray.
  const statusRaw = await blackBackgroundToTransparent(fs.readFileSync(srcStatusLogo));
  const status512 = await fitOnCanvas(statusRaw, 512, {
    padRatio: 0.0,
    bg: clearBg,
  });
  const statusDrawablePath = path.join(resRoot, "drawable", "ic_notification_small.png");
  fs.writeFileSync(statusDrawablePath, status512);
  console.log(`Wrote ${path.relative(root, statusDrawablePath)} (from pwa-512.png)`);
  for (const [density, size] of Object.entries(STATUS_ICON)) {
    const buf = await fitOnCanvas(statusRaw, size, {
      padRatio: 0.0,
      bg: clearBg,
    });
    const dir = path.join(resRoot, `drawable-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "ic_notification_small.png");
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${path.relative(root, out)}`);
  }

  // Splash logo: transparan (hitam source sudah dibuang).
  const splashLogo512 = await fitOnCanvas(officeLogo, 512, {
    padRatio: 0.14,
    bg: clearBg,
  });
  const splashLogoPath = path.join(resRoot, "drawable", "splash_logo.png");
  fs.writeFileSync(splashLogoPath, splashLogo512);
  console.log(`Wrote ${path.relative(root, splashLogoPath)}`);

  // Adaptive foreground mipmaps (mask sistem); putih di belakang lewat ic_launcher_background.
  for (const [density, size] of Object.entries(FOREGROUND)) {
    const buf = await fitOnCanvas(officeLogo, size, {
      padRatio: 0.18,
      bg: clearBg,
    });
    const dir = path.join(resRoot, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "ic_launcher_foreground.png");
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${path.relative(root, out)}`);
  }

  // Legacy full icons — wrapper putih murni.
  for (const [density, size] of Object.entries(LAUNCHER)) {
    const buf = await fitOnCanvas(officeLogo, size, {
      padRatio: 0.1,
      bg: whiteBg,
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
  // Background #f5f5f5 matches `splash_screen_background` / capacitor.config.ts.
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
    const logoSize = Math.round(Math.min(w, h) * 0.55);
    const logo = await sharp(officeLogo)
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

  console.log("Done — Synckerja Office Android icons updated from public/synckerjaoffice.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
