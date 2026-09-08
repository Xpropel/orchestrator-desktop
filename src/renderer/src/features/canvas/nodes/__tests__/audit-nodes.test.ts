import { describe, expect, it } from 'vitest'
import { CARD_CHROME_HEADER_PX, CARD_MIN_HEIGHT, CARD_MODEL_BADGE_PX, cardChromeHeaderPx } from '../card-metrics'
import { BRANCH_OUTLET_NUDGE_PX, BRANCH_ROW_H, branchOutletTop, measureRowCenterY } from '../branch-outlet'
import { PILL_MIN_HEIGHT } from '../card-resizer'
import { orderedPortsMinHeight } from '../ordered-source-ports'

describe('branchOutletTop vs chrome header', () => {
  it('places the first outlet at the row center under the title block', () => {
    expect(cardChromeHeaderPx(false)).toBe(CARD_CHROME_HEADER_PX)
    expect(branchOutletTop(0, false)).toBe(CARD_CHROME_HEADER_PX + BRANCH_OUTLET_NUDGE_PX + BRANCH_ROW_H / 2)
    expect(branchOutletTop(1, false)).toBe(
      CARD_CHROME_HEADER_PX + BRANCH_OUTLET_NUDGE_PX + BRANCH_ROW_H + BRANCH_ROW_H / 2
    )
  })

  it('converts a scaled row rect into the local handle top', () => {
    const root = {
      offsetHeight: 100,
      getBoundingClientRect: () => ({ top: 200, height: 200 })
    }
    const row = {
      getBoundingClientRect: () => ({ top: 308, height: 64 })
    }
    expect(measureRowCenterY(root, row)).toBe(70)
  })

  it('shifts every outlet down when a model badge is present', () => {
    expect(cardChromeHeaderPx(true)).toBe(CARD_CHROME_HEADER_PX + CARD_MODEL_BADGE_PX)
    expect(branchOutletTop(0, true) - branchOutletTop(0, false)).toBe(CARD_MODEL_BADGE_PX)
    expect(branchOutletTop(2, true) - branchOutletTop(2, false)).toBe(CARD_MODEL_BADGE_PX)
  })

  it('keeps card min height at or above header plus one row', () => {
    const oneRow = cardChromeHeaderPx(false) + BRANCH_ROW_H
    expect(CARD_MIN_HEIGHT).toBeGreaterThanOrEqual(80)
    expect(Math.max(CARD_MIN_HEIGHT, oneRow)).toBeGreaterThanOrEqual(oneRow)
    expect(Math.max(CARD_MIN_HEIGHT, cardChromeHeaderPx(true) + BRANCH_ROW_H)).toBeGreaterThanOrEqual(
      CARD_CHROME_HEADER_PX + CARD_MODEL_BADGE_PX + BRANCH_ROW_H
    )
  })
})

describe('port-aware min height', () => {
  it('grows past the pill floor when many start ports are occupied', () => {
    expect(orderedPortsMinHeight(0)).toBe(PILL_MIN_HEIGHT)
    expect(orderedPortsMinHeight(4)).toBeGreaterThan(PILL_MIN_HEIGHT)
    expect(Math.max(PILL_MIN_HEIGHT, orderedPortsMinHeight(4))).toBe(orderedPortsMinHeight(4))
  })
})
