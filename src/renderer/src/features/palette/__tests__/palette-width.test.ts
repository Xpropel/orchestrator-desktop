import { describe, expect, it } from 'vitest'
import {
  FLYOUT_WIDTH,
  PALETTE_MIN_TEXT_WIDTH,
  PALETTE_RAIL_WIDTH,
  isRailWidth,
  placeOperatorFlyout,
  snapPaletteWidth
} from '../palette-width'

describe('snapPaletteWidth', () => {
  it('snaps to the icon rail below the midpoint and back to text width above it', () => {
    const midpoint = (PALETTE_RAIL_WIDTH + PALETTE_MIN_TEXT_WIDTH) / 2
    expect(snapPaletteWidth(midpoint - 1)).toBe(PALETTE_RAIL_WIDTH)
    expect(snapPaletteWidth(midpoint)).toBe(PALETTE_MIN_TEXT_WIDTH)
    expect(snapPaletteWidth(PALETTE_RAIL_WIDTH)).toBe(PALETTE_RAIL_WIDTH)
  })

  it('leaves comfortable widths alone', () => {
    expect(snapPaletteWidth(240)).toBe(240)
  })

  it('reports rail mode only at the rail width', () => {
    expect(isRailWidth(PALETTE_RAIL_WIDTH)).toBe(true)
    expect(isRailWidth(PALETTE_MIN_TEXT_WIDTH)).toBe(false)
  })
})

describe('placeOperatorFlyout', () => {
  it('flips to the left when the right side does not fit', () => {
    const placed = placeOperatorFlyout({ x: 1400, y: 20, width: 180 }, { width: 1600, height: 1000 }, 400)
    expect(placed.side).toBe('left')
    expect(placed.left + FLYOUT_WIDTH).toBeLessThanOrEqual(1400)
  })

  it('shifts up when the palette sits near the bottom edge', () => {
    const placed = placeOperatorFlyout({ x: 12, y: 900, width: 216 }, { width: 1600, height: 1000 }, 400)
    expect(placed.top + placed.height).toBeLessThanOrEqual(1000 - 12)
    expect(placed.top).toBeGreaterThanOrEqual(12)
    expect(placed.side).toBe('right')
  })
})
