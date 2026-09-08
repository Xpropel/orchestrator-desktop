import { describe, expect, it } from 'vitest'
import {
  PALETTE_MIN_TEXT_WIDTH,
  PALETTE_RAIL_WIDTH,
  isRailWidth,
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
