/**
 * 组件栏宽度：自由拉伸，但窄到一定程度不再挤压文字，而是吸附成仅图标的窄栏。
 * 窄栏 ↔ 文字栏的切换点取两档宽度的中点，拖回去即恢复。
 */
export const PALETTE_RAIL_WIDTH = 56
export const PALETTE_MIN_TEXT_WIDTH = 168
export const PALETTE_MAX_WIDTH = 360
export const PALETTE_DEFAULT_WIDTH = 216

const SNAP_POINT = (PALETTE_RAIL_WIDTH + PALETTE_MIN_TEXT_WIDTH) / 2

export function snapPaletteWidth(width: number): number {
  if (width < SNAP_POINT) return PALETTE_RAIL_WIDTH
  return Math.max(width, PALETTE_MIN_TEXT_WIDTH)
}

export function isRailWidth(width: number): boolean {
  return width <= PALETTE_RAIL_WIDTH
}
