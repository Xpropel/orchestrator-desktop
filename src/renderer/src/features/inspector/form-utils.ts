import { asStringArray } from '@/core/form/as-string-array'
import { valuesEqual } from '@/core/form/values-equal'

export { asStringArray, valuesEqual }

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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
