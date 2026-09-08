import type { BaseNodeData } from '../types'

// `model` 由卡片的模型徽标单独展示（core/models.ts），不再进摘要行。
const SUMMARY_KEYS = [
  'prompt',
  'url',
  'method',
  'expression',
  'items',
  'content',
  'template',
  'code',
  'query',
  'condition',
  'path'
] as const

export function getNodeSummary(data: BaseNodeData): string {
  const form = data.form
  for (const key of SUMMARY_KEYS) {
    const value = form[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().slice(0, 80)
    }
    if (typeof value === 'number') {
      return `${key} ${value}`
    }
  }
  return data.description ?? ''
}
