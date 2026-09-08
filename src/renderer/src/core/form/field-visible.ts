import { valuesEqual } from './values-equal'

export function fieldVisible(
  form: Record<string, unknown>,
  field: { showWhen?: { key: string; equals: unknown } }
): boolean {
  if (!field.showWhen) return true
  return valuesEqual(form[field.showWhen.key], field.showWhen.equals)
}
