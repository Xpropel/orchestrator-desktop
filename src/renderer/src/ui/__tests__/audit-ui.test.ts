import { describe, expect, it } from 'vitest'
import { unsavedConfirmFallback } from '@/platform/platform'
import { cancelOpenUnsavedDialog, showUnsavedDialog } from '@/ui/unsaved-dialog'
import { clampPopover } from '@/ui/clamp-popover'
import { CARD_HEADER_HEIGHT, CARD_MARGIN, clampRect, type CardLimits, type CardRect } from '@/ui/floating-card/floating-card-rect'
import { committedTitle } from '@/app/title-edit'
import { textFieldMenuBehavior } from '@/ui/text-input-edit'

const inspector: CardLimits = {
  minWidth: 300,
  maxWidth: 640,
  minHeight: 200,
  defaultWidth: 360,
  defaultHeight: 560,
  anchor: 'right'
}

function rect(partial: Partial<CardRect>): CardRect {
  return { x: 100, y: 100, width: 360, height: 560, fixedHeight: false, ...partial }
}

describe('floating card clamp', () => {
  it('pulls a 4k stored rect back into a 1024×680 window using visible height', () => {
    const stored = rect({ x: 3200, y: 1800, width: 360, height: 900, fixedHeight: true })
    const clamped = clampRect(inspector, stored, { width: 1024, height: 680 }, 400)
    expect(clamped.x).toBe(1024 - 360 - CARD_MARGIN)
    expect(clamped.y).toBe(680 - 400 - CARD_MARGIN)
    expect(clamped.y).toBeGreaterThanOrEqual(CARD_MARGIN)
    expect(clamped.width).toBeLessThanOrEqual(1024 - CARD_MARGIN * 2)
  })

  it('rounds-friendly visible height still keeps the header on screen when collapsed', () => {
    const clamped = clampRect(inspector, rect({ y: 2000 }), { width: 1200, height: 800 }, CARD_HEADER_HEIGHT)
    expect(clamped.y).toBe(800 - CARD_HEADER_HEIGHT - CARD_MARGIN)
  })
})

describe('unsaved confirm before boot', () => {
  it('falls back to cancel so a pre-boot file action cannot discard work', async () => {
    expect(await unsavedConfirmFallback('未保存的更改将丢失')).toBe('cancel')
  })
})

describe('unsaved dialog', () => {
  it('cancels the previous prompt when a second one opens', async () => {
    const first = showUnsavedDialog('first')
    const second = showUnsavedDialog('second')
    await expect(first).resolves.toBe('cancel')
    showUnsavedDialog('third')
    await expect(second).resolves.toBe('cancel')
    cancelOpenUnsavedDialog()
  })
})

describe('popover clamp', () => {
  it('keeps a menu inside the viewport including the top edge', () => {
    expect(clampPopover(-40, -20, 200, 80, { width: 1024, height: 680 })).toEqual({ left: 8, top: 8 })
    expect(clampPopover(900, 650, 200, 80, { width: 1024, height: 680 }).left).toBeLessThanOrEqual(1024 - 200 - 8)
  })
})

describe('title commit helper', () => {
  it('does not persist an empty toolbar title', () => {
    expect(committedTitle('')).toBe('Untitled')
    expect(textFieldMenuBehavior('delete')).toBe('native-edit')
  })
})
