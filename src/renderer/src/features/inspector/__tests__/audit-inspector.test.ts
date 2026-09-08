import { describe, expect, it } from 'vitest'
import { parseCases, parseCategories } from '@/core/form-items'
import { clampNumber, coerceFiniteNumber } from '@/core/form/as-string-array'
import { asNumber, insertAtCaret } from '@/features/inspector/form-utils'
import { nextDebouncedFromIncoming } from '@/ui/use-debounced-commit'

describe('parseCases / parseCategories ids stay stable', () => {
  it('assigns the same case-${index} ids across two parses of id-less cases', () => {
    const raw = [{ label: 'Yes', expression: 'x > 0' }, { label: 'No', expression: 'x <= 0' }]
    const first = parseCases(raw)
    const second = parseCases(raw)
    expect(first.map((item) => item.id)).toEqual(['case-0', 'case-1'])
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id))
    expect(parseCategories([{ name: 'Spam' }, { name: 'Ham' }]).map((item) => item.id)).toEqual([
      'category-0',
      'category-1'
    ])
  })
})

describe('insertAtCaret', () => {
  it('inserts at the caret and replaces a selection', () => {
    expect(insertAtCaret('hello', '{{A.x}}', 5, 5)).toEqual({ next: 'hello{{A.x}}', caret: 12 })
    expect(insertAtCaret('ab', '{{A.x}}', 1, 1)).toEqual({ next: 'a{{A.x}}b', caret: 8 })
    expect(insertAtCaret('hello world', '{{A.x}}', 6, 11)).toEqual({ next: 'hello {{A.x}}', caret: 13 })
  })
})

describe('coerceFiniteNumber / asNumber / clampNumber', () => {
  it('accepts numeric strings from imported JSON', () => {
    expect(coerceFiniteNumber('12.5')).toBe(12.5)
    expect(coerceFiniteNumber(' 3 ')).toBe(3)
    expect(coerceFiniteNumber('')).toBeUndefined()
    expect(coerceFiniteNumber('nope')).toBeUndefined()
    expect(coerceFiniteNumber(Number.NaN)).toBeUndefined()
    expect(asNumber('0.7', 0)).toBe(0.7)
    expect(asNumber('bad', 2)).toBe(2)
  })

  it('clamps to min/max', () => {
    expect(clampNumber(99, 0, 10)).toBe(10)
    expect(clampNumber(-2, 0, 10)).toBe(0)
    expect(clampNumber(5, 0, 10)).toBe(5)
  })
})

describe('nextDebouncedFromIncoming', () => {
  it('ignores the store echo of a flush while the user is still typing', () => {
    expect(nextDebouncedFromIncoming('hello', 'hel', 'hel')).toBeNull()
  })

  it('accepts undo/load values that differ from both local and committed', () => {
    expect(nextDebouncedFromIncoming('hello', 'hello', 'old')).toEqual({ local: 'old', committed: 'old' })
  })

  it('does not reset when the incoming value already matches the synced field', () => {
    expect(nextDebouncedFromIncoming('hel', 'hel', 'hel')).toBeNull()
  })
})
