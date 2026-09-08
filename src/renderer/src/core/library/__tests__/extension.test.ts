import { describe, expect, it } from 'vitest'
import { issue } from '../../validate/issue'
import type { OperatorCategory, OperatorDefinition } from '../../schema'
import { mergeExtensions, type LibraryExtension } from '../index'

const category: OperatorCategory = {
  key: 'demo',
  title: 'Demo',
  order: 200,
  exclusive: true,
  icon: 'Sparkles'
}

const operator: OperatorDefinition = {
  type: 'demo.echo',
  title: 'Echo',
  description: 'Echo a string',
  icon: 'Sparkles',
  color: '#6366f1',
  category: 'demo',
  kind: 'task',
  params: [{ key: 'text', label: 'text', type: 'string' }],
  outputs: [{ name: 'text', type: 'string' }]
}

const extension = {
  categories: [category],
  operators: [operator],
  rules: [
    (context) =>
      context.nodes.length === 0
        ? [issue('error', 'DEMO_EMPTY', 'demo extension saw an empty graph')]
        : []
  ],
  globals: [
    {
      key: 'demo',
      title: 'Demo globals',
      fields: [{ key: 'token', label: 'token', hint: 'optional' }]
    }
  ]
} satisfies LibraryExtension

describe('mergeExtensions', () => {
  it('picks up categories, operators, rules, and globals from a fake extension', () => {
    const merged = mergeExtensions([extension])
    expect(merged.categories).toEqual([category])
    expect(merged.operators).toEqual([operator])
    expect(merged.globals).toEqual(extension.globals)
    expect(merged.rules).toHaveLength(1)
    const issues = merged.rules[0]?.({
      nodes: [],
      edges: [],
      globals: {},
      getOperator: () => undefined
    })
    expect(issues?.map((item) => item.code)).toEqual(['DEMO_EMPTY'])
  })

  it('concatenates multiple extensions and treats missing rules/globals as empty', () => {
    const extra: LibraryExtension = {
      categories: [{ key: 'other', title: 'Other', order: 210 }],
      operators: [{ ...operator, type: 'other.ping', category: 'other' }]
    }
    const merged = mergeExtensions([extension, extra])
    expect(merged.categories.map((item) => item.key)).toEqual(['demo', 'other'])
    expect(merged.operators.map((item) => item.type)).toEqual(['demo.echo', 'other.ping'])
    expect(merged.rules).toHaveLength(1)
    expect(merged.globals).toHaveLength(1)
  })
})
