import { VISUAL_THEME } from "./visual-theme";

/** Delivery's speech-wave mark. A single path keeps every output identical. */
export const BRAND_MARK_PATH = "M12 8H32C45.3 8 56 17.4 56 30S45.3 52 32 52H27L12 62V8ZM22 24V36H26V24H22ZM31 18V42H35V18H31ZM40 22V38H44V22H40Z";

export const BRAND_GRADIENT_STOPS = [
  [0, VISUAL_THEME.blue],
  [0.45, VISUAL_THEME.violet],
  [0.8, VISUAL_THEME.pink],
  [1, VISUAL_THEME.orange],
] as const;

/** SVG exports share the same spectrum as the in-app mark and canvas cards. */
export function brandGradientSvg(id: string) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${BRAND_GRADIENT_STOPS.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join("")}</linearGradient></defs>`;
}
