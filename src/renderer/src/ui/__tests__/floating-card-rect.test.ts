import { describe, expect, it } from 'vitest'
import {
  CARD_MARGIN,
  applyResize,
  clampRect,
  defaultRect,
  type CardLimits,
  type CardRect
} from '../floating-card/floating-card-rect'

const container = { width: 1200, height: 800 }

const right: CardLimits = {
  minWidth: 300,
  maxWidth: 640,
  minHeight: 200,
  defaultWidth: 360,
  defaultHeight: 560,
  anchor: 'right'
}

const left: CardLimits = {
  minWidth: 56,
  maxWidth: 360,
  minHeight: 160,
  defaultWidth: 216,
  defaultHeight: 520,
  anchor: 'left',
  snapWidth: (width) => (width < 112 ? 56 : Math.max(width, 168))
}

function rect(partial: Partial<CardRect>): CardRect {
  return { x: 100, y: 100, width: 360, height: 560, fixedHeight: false, ...partial }
}

describe('defaultRect', () => {
  it('docks to the anchored side with the card margin', () => {
    expect(defaultRect(right, container)).toEqual({
      x: 1200 - 360 - CARD_MARGIN,
      y: CARD_MARGIN,
      width: 360,
      height: 560,
      fixedHeight: false
    })
    expect(defaultRect(left, container)).toMatchObject({ x: CARD_MARGIN, y: CARD_MARGIN, width: 216 })
  })
})

describe('clampRect', () => {
  it('keeps the card inside the container using its visible height', () => {
    const clamped = clampRect(right, rect({ x: 2000, y: 2000, height: 560 }), container, 300)
    expect(clamped.x).toBe(1200 - 360 - CARD_MARGIN)
    // 只按实际可见的 300px 夹边，而不是 rect.height。
    expect(clamped.y).toBe(800 - 300 - CARD_MARGIN)
  })

  it('applies width snapping before positioning', () => {
    const clamped = clampRect(left, rect({ x: 12, width: 90 }), container, 200)
    expect(clamped.width).toBe(56)
    expect(clampRect(left, rect({ x: 12, width: 130 }), container, 200).width).toBe(168)
  })
})

describe('applyResize', () => {
  it('pulls the left edge while the right edge stays put', () => {
    const start = rect({ x: 500, width: 360 })
    const next = applyResize(right, 'left', -100, 0, start, container, 560)
    expect(next.width).toBe(460)
    expect(next.x + next.width).toBe(860)
  })

  it('pulls the right edge while the left edge stays put and snaps to the rail', () => {
    const start = rect({ x: 12, width: 216 })
    const wider = applyResize(left, 'right', 60, 0, start, container, 400)
    expect(wider).toMatchObject({ x: 12, width: 276 })
    const rail = applyResize(left, 'right', -140, 0, start, container, 400)
    expect(rail).toMatchObject({ x: 12, width: 56 })
  })

  it('grows height from the visible height and pins it afterwards', () => {
    const start = rect({ height: 560, fixedHeight: false })
    const next = applyResize(right, 'bottom', 40, 40, start, container, 300)
    expect(next.height).toBe(340)
    expect(next.fixedHeight).toBe(true)
    expect(next.width).toBe(start.width)
  })
})
