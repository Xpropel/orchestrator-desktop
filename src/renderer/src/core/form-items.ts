import { nanoid } from 'nanoid'
import { isRecord, isVarType, type AssignmentItem, type CaseItem, type CategoryItem, type InputItem, type KeyValueItem, type VarType } from './schema'

export function parseCases(value: unknown): CaseItem[] {
  if (!Array.isArray(value)) return []
  const cases: CaseItem[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      cases.push({ id: nanoid(8), label: `Case ${index + 1}`, expression: '' })
      continue
    }
    cases.push({
      id: typeof item.id === 'string' && item.id.length > 0 ? item.id : nanoid(8),
      label: typeof item.label === 'string' ? item.label : `Case ${index + 1}`,
      expression: typeof item.expression === 'string' ? item.expression : ''
    })
  }
  return cases
}

export function parseCategories(value: unknown): CategoryItem[] {
  if (!Array.isArray(value)) return []
  const categories: CategoryItem[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      categories.push({ id: nanoid(8), name: `Category ${index + 1}`, description: '' })
      continue
    }
    categories.push({
      id: typeof item.id === 'string' && item.id.length > 0 ? item.id : nanoid(8),
      name: typeof item.name === 'string' ? item.name : `Category ${index + 1}`,
      description: typeof item.description === 'string' ? item.description : ''
    })
  }
  return categories
}

export function parseInputs(value: unknown): InputItem[] {
  if (!Array.isArray(value)) return []
  const inputs: InputItem[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const key = typeof item.key === 'string' ? item.key : ''
    const type: VarType = isVarType(item.type) ? item.type : 'string'
    inputs.push({
      key,
      type,
      required: item.required === true,
      description: typeof item.description === 'string' ? item.description : ''
    })
  }
  return inputs
}

export function parseAssignments(value: unknown): AssignmentItem[] {
  if (!Array.isArray(value)) return []
  const assignments: AssignmentItem[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    assignments.push({
      id: typeof item.id === 'string' && item.id.length > 0 ? item.id : nanoid(8),
      variable: typeof item.variable === 'string' ? item.variable : '',
      value: typeof item.value === 'string' ? item.value : ''
    })
  }
  return assignments
}

export function parseKeyValueItems(value: unknown): KeyValueItem[] {
  if (Array.isArray(value)) {
    const items: KeyValueItem[] = []
    for (const item of value) {
      if (!isRecord(item)) continue
      items.push({
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : nanoid(8),
        key: typeof item.key === 'string' ? item.key : '',
        value: typeof item.value === 'string' ? String(item.value) : item.value == null ? '' : String(item.value)
      })
    }
    return items
  }
  if (!isRecord(value)) return []
  return Object.entries(value).map(([key, entry]) => ({
    id: key.length > 0 ? key : nanoid(8),
    key,
    value: typeof entry === 'string' ? entry : entry == null ? '' : String(entry)
  }))
}

export function keyValueItemsToRecord(items: KeyValueItem[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of items) {
    if (item.key.length === 0) continue
    result[item.key] = item.value
  }
  return result
}
