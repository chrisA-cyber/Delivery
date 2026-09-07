// Compile the code-native SVG mark to the existing PWA raster sizes.
import sharp from "sharp";
import fs from "node:fs/promises";
const mark = await fs.readFile(new URL("../public/icon.svg", import.meta.url));
await Promise.all([
  ...[
    [192, "icon-192.png"],
    [512, "icon-512.png"],
    [180, "apple-touch-icon.png"],
  ].map(([size, name]) =>
    sharp(mark)
      .resize(size, size)
      .png()
      .toFile(new URL(`../public/${name}`, import.meta.url).pathname),
  ),
  sharp(mark)
    .resize(320, 320)
    .extend({ top: 96, bottom: 96, left: 96, right: 96, background: "#ffc266" })
    .png()
    .toFile(
      new URL("../public/icon-maskable-512.png", import.meta.url).pathname,
    ),
]);
console.log("Rendered the SVG mark to four existing PWA icon sizes.");
