import { describe, expect, it } from 'vitest'
import { canvasPanHint, canvasPointerBehavior } from '../pointer-behavior'

describe('canvasPointerBehavior', () => {
  it('lets a Mac trackpad pan with two-finger scroll and keeps mouse buttons', () => {
    const mac = canvasPointerBehavior('darwin')
    expect(mac.panOnScroll).toBe(true)
    expect(mac.zoomOnScroll).toBe(false)
    expect(mac.panOnDrag).toEqual([1, 2])
    expect(mac.panActivationKeyCode).toBe('Space')
    expect(mac.zoomActivationKeyCode).toBe('Meta')
    expect(canvasPanHint('darwin')).toMatch(/双指/)
  })

  it('keeps Windows wheel-zoom and middle-button pan', () => {
    const win = canvasPointerBehavior('win32')
    expect(win.panOnScroll).toBe(false)
    expect(win.zoomOnScroll).toBe(true)
    expect(win.panOnDrag).toEqual([1, 2])
    expect(win.zoomActivationKeyCode).toBe('Control')
  })
})
