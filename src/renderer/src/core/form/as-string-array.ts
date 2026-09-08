export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value
  if (min !== undefined && Number.isFinite(min) && next < min) next = min
  if (max !== undefined && Number.isFinite(max) && next > max) next = max
  return next
}
