export function clampPopover(
  x: number,
  y: number,
  width: number,
  height: number,
  viewport: { width: number; height: number },
  pad = 8
): { left: number; top: number } {
  let left = x
  let top = y
  if (left + width > viewport.width - pad) {
    left = Math.max(pad, viewport.width - width - pad)
  }
  if (top + height > viewport.height - pad) {
    top = Math.max(pad, viewport.height - height - pad)
  }
  if (left < pad) left = pad
  if (top < pad) top = pad
  return { left, top }
}
