// Run with node --import tsx scripts/render-icons.mjs.
// One source supplies the header, exported videos, social cards and PWA icons.
import sharp from "sharp";
import fs from "node:fs/promises";
import brand from "../src/lib/brand.ts";
const { BRAND_MARK_PATH, brandGradientSvg } = brand;
import theme from "../src/lib/visual-theme.ts";
const { VISUAL_THEME } = theme;
const svg = (maskable = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <rect width="64" height="64" rx="${maskable ? 0 : 16}" fill="${VISUAL_THEME.ink}"/>\n  ${brandGradientSvg("delivery-icon-spectrum")}\n  <path d="${BRAND_MARK_PATH}" transform="${maskable ? 'translate(12 9) scale(.6)' : 'translate(4 1) scale(.85)'}" fill="url(#delivery-icon-spectrum)" fill-rule="evenodd"/>\n</svg>\n`;
const mark = Buffer.from(svg());
const maskable = Buffer.from(svg(true));
await Promise.all([
  fs.writeFile(new URL("../public/icon.svg", import.meta.url), mark),
  fs.writeFile(new URL("../public/icon-maskable.svg", import.meta.url), maskable),
  ...[[192, "icon-192.png"], [512, "icon-512.png"], [180, "apple-touch-icon.png"]].map(([size, name]) =>
    sharp(mark).resize(size, size).png().toFile(new URL(`../public/${name}`, import.meta.url).pathname),
  ),
  sharp(maskable).resize(512, 512).png().toFile(new URL("../public/icon-maskable-512.png", import.meta.url).pathname),
]);
console.log("Rendered the shared mark to two SVGs and four PWA raster sizes.");
