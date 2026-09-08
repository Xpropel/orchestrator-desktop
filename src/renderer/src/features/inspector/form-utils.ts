import { asStringArray, clampNumber, coerceFiniteNumber } from '@/core/form/as-string-array'
import { valuesEqual } from '@/core/form/values-equal'

export { asStringArray, clampNumber, coerceFiniteNumber, valuesEqual }

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asNumber(value: unknown, fallback: number): number {
  return coerceFiniteNumber(value) ?? fallback
}

export function insertAtCaret(
  text: string,
  insert: string,
  start: number,
  end: number
): { next: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  return { next: `${text.slice(0, from)}${insert}${text.slice(to)}`, caret: from + insert.length }
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) {
    return items
  }
  const next = items.slice()
  const [picked] = next.splice(index, 1)
  next.splice(target, 0, picked)
  return next
}

export function splitTemplateSegments(text: string): { kind: 'text' | 'ref'; value: string }[] {
  const segments: { kind: 'text' | 'ref'; value: string }[] = []
  const pattern = /\{\{[^{}]+\}\}/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'text', value: text.slice(last, match.index) })
    }
    segments.push({ kind: 'ref', value: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    segments.push({ kind: 'text', value: text.slice(last) })
  }
  return segments
}
