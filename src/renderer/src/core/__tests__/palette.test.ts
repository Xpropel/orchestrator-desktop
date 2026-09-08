import { beforeAll, describe, expect, it } from 'vitest'
import { createStartNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import { getOperator } from '@/core/registry'
import { isPaletteOperator, listPaletteOperators, sortCategoriesForSidebar } from '@/core/palette'

beforeAll(() => {
  loadLibrary()
})

describe('palette constraints', () => {
  it('hides operators marked hidden', () => {
    const start = createStartNode()
    expect(getOperator('loop-start').constraints?.hidden).toBe(true)
    expect(isPaletteOperator(getOperator('loop-start'), [start])).toBe(false)
    expect(listPaletteOperators([start]).some((item) => item.type === 'loop-start')).toBe(false)
  })

  it('keeps start visible after one is already on the canvas', () => {
    const start = createStartNode()
    expect(getOperator('start').constraints?.maxInstances).toBeUndefined()
    expect(isPaletteOperator(getOperator('start'), [start])).toBe(true)
    expect(isPaletteOperator(getOperator('start'), [])).toBe(true)
  })

  it('pins exclusive categories to the bottom of the sidebar', () => {
    const sorted = sortCategoriesForSidebar([
      { key: 'z-exclusive', title: 'Z', order: 1, exclusive: true },
      { key: 'a', title: 'A', order: 2 },
      { key: 'm-exclusive', title: 'M', order: 3, exclusive: true }
    ])
    expect(sorted.map((item) => item.key)).toEqual(['a', 'z-exclusive', 'm-exclusive'])
  })
})
