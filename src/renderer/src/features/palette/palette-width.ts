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

export const FLYOUT_WIDTH = 280
export const FLYOUT_GAP = 8
export const FLYOUT_MIN_HEIGHT = 360

export function placeOperatorFlyout(
  rect: { x: number; y: number; width: number },
  container: { width: number; height: number },
  visibleHeight: number,
  margin = 12
): { left: number; top: number; height: number; side: 'left' | 'right' } {
  const rightX = rect.x + rect.width + FLYOUT_GAP
  const fitsRight = rightX + FLYOUT_WIDTH <= container.width - margin
  const left = fitsRight ? rightX : Math.max(margin, rect.x - FLYOUT_GAP - FLYOUT_WIDTH)
  const maxHeight = Math.max(80, container.height - margin * 2)
  const height = Math.min(Math.max(visibleHeight, FLYOUT_MIN_HEIGHT), maxHeight)
  const maxTop = container.height - margin - height
  const top = Math.min(Math.max(rect.y, margin), Math.max(margin, maxTop))
  return { left, top, height, side: fitsRight ? 'right' : 'left' }
}
