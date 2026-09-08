import { listCategories, listOperators, listOperatorsByCategory } from '@/core/registry'
import type { OperatorCategory, OperatorDefinition } from '@/core/schema'
import type { FlowNode } from '@/core/types'

export const CATEGORY_ICON_NAMES: Record<string, string> = {
  control: 'Play',
  logic: 'GitBranch',
  llm: 'Bot',
  knowledge: 'BookOpen',
  data: 'Database',
  integration: 'Plug',
  interaction: 'MessageSquare',
  misc: 'Puzzle'
}

export function categoryIconName(category: OperatorCategory | string): string {
  if (typeof category === 'string') {
    return CATEGORY_ICON_NAMES[category] ?? 'Puzzle'
  }
  return category.icon ?? CATEGORY_ICON_NAMES[category.key] ?? 'Puzzle'
}

export function exclusiveAccent(category: OperatorCategory | undefined): string | undefined {
  if (!category?.exclusive) return undefined
  return category.accent ?? '#ea580c'
}

export function isPaletteOperator(operator: OperatorDefinition, nodes: FlowNode[]): boolean {
  if (operator.constraints?.hidden) return false
  const max = operator.constraints?.maxInstances
  if (typeof max === 'number') {
    const used = nodes.filter((node) => node.data.label === operator.type).length
    if (used >= max) return false
  }
  return true
}

export function listPaletteOperators(nodes: FlowNode[]): OperatorDefinition[] {
  return listOperators().filter((operator) => isPaletteOperator(operator, nodes))
}

export function listPaletteByCategory(key: string, nodes: FlowNode[]): OperatorDefinition[] {
  return listOperatorsByCategory(key).filter((operator) => isPaletteOperator(operator, nodes))
}

export function sortCategoriesForSidebar(categories = listCategories()): OperatorCategory[] {
  const rest = categories
    .filter((category) => !category.exclusive)
    .sort((left, right) => left.order - right.order)
  const exclusive = categories
    .filter((category) => category.exclusive)
    .sort((left, right) => left.order - right.order)
  return [...rest, ...exclusive]
}

export function operatorMatchesQuery(operator: OperatorDefinition, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    operator.title.toLowerCase().includes(needle) ||
    operator.description.toLowerCase().includes(needle) ||
    operator.type.toLowerCase().includes(needle)
  )
}
