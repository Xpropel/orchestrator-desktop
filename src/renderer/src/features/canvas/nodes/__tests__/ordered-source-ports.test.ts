import { describe, expect, it } from 'vitest'
import {
  hoverSlotFromDelta,
  isClickDisplacement,
  orderedPortTop,
  pointerDeltaToPortOffset,
  yieldedSlot,
  SOURCE_PORT_PITCH
} from '../ordered-source-ports'

describe('yieldedSlot', () => {
  it('moves index 0 to slot 2 as 2 3 1 4', () => {
    expect(yieldedSlot(0, 2, 0, 4)).toBe(2)
    expect(yieldedSlot(0, 2, 1, 4)).toBe(0)
    expect(yieldedSlot(0, 2, 2, 4)).toBe(1)
    expect(yieldedSlot(0, 2, 3, 4)).toBe(3)
  })
})

describe('hoverSlotFromDelta', () => {
  it('uses 20px pitch and clamps', () => {
    expect(hoverSlotFromDelta(0, SOURCE_PORT_PITCH * 2, 4)).toBe(2)
    expect(hoverSlotFromDelta(0, -100, 4)).toBe(0)
    expect(hoverSlotFromDelta(3, 100, 4)).toBe(3)
  })
})

describe('isClickDisplacement', () => {
  it('treats sub-4px as a click', () => {
    expect(isClickDisplacement(0, 0)).toBe(true)
    expect(isClickDisplacement(3, 0)).toBe(true)
    expect(isClickDisplacement(0, 4)).toBe(false)
    expect(isClickDisplacement(3, 3)).toBe(false)
  })
})

describe('orderedPortTop', () => {
  it('offsets the dragged port by extra pixels without a transform', () => {
    expect(orderedPortTop(0, 4)).toBe('calc(50% + -40px)')
    expect(orderedPortTop(0, 4, 16)).toBe('calc(50% + -24px)')
  })
})

describe('pointerDeltaToPortOffset', () => {
  it('divides screen delta by viewport zoom', () => {
    expect(pointerDeltaToPortOffset(40, 1)).toBe(40)
    expect(pointerDeltaToPortOffset(40, 0.5)).toBe(80)
    expect(pointerDeltaToPortOffset(40, 0)).toBe(40)
  })
})
