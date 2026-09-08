import { isRecord, isVarType, type AssignmentItem, type CaseItem, type CategoryItem, type InputItem, type KeyValueItem, type VarType } from './schema'

function stableId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export function parseCases(value: unknown): CaseItem[] {
  if (!Array.isArray(value)) return []
  const cases: CaseItem[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      cases.push({ id: `case-${index}`, label: `Case ${index + 1}`, expression: '' })
      continue
    }
    cases.push({
      id: stableId(item.id, `case-${index}`),
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
      categories.push({ id: `category-${index}`, name: `Category ${index + 1}`, description: '' })
      continue
    }
    categories.push({
      id: stableId(item.id, `category-${index}`),
      name: typeof item.name === 'string' ? item.name : `Category ${index + 1}`,
      description: typeof item.description === 'string' ? item.description : ''
    })
  }
  return categories
}

export function parseInputs(value: unknown): InputItem[] {
  if (!Array.isArray(value)) return []
  const inputs: InputItem[] = []
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) continue
    const key = typeof item.key === 'string' ? item.key : ''
    const type: VarType = isVarType(item.type) ? item.type : 'string'
    inputs.push({
      id: stableId(item.id, `input-${index}`),
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
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) continue
    assignments.push({
      id: stableId(item.id, `assign-${index}`),
      variable: typeof item.variable === 'string' ? item.variable : '',
      value: typeof item.value === 'string' ? item.value : ''
    })
  }
  return assignments
}

export function parseKeyValueItems(value: unknown): KeyValueItem[] {
  if (Array.isArray(value)) {
    const items: KeyValueItem[] = []
    for (const [index, item] of value.entries()) {
      if (!isRecord(item)) continue
      items.push({
        id: stableId(item.id, `kv-${index}`),
        key: typeof item.key === 'string' ? item.key : '',
        value: typeof item.value === 'string' ? String(item.value) : item.value == null ? '' : String(item.value)
      })
    }
    return items
  }
  if (!isRecord(value)) return []
  return Object.entries(value).map(([key, entry]) => ({
    id: key.length > 0 ? key : 'kv-empty',
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
