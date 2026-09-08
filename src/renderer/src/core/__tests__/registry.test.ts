import { beforeAll, describe, expect, it } from 'vitest'
import { builtinLibrary, loadLibrary } from '../library'
import { listPaletteByCategory } from '../palette'
import {
  getDefaultForm,
  getKindForNodeType,
  getNodeTypeForKind,
  getOperator,
  getSourceHandles,
  getTargetHandles,
  hasOperator,
  listCategories,
  listOperators,
  listOperatorsByCategory
} from '../registry'

beforeAll(() => {
  loadLibrary()
})

describe('registry', () => {
  it('registers every public builtin operator', () => {
    expect(listOperators().length).toBeGreaterThanOrEqual(builtinLibrary.operators.length)
    for (const operator of builtinLibrary.operators) {
      expect(hasOperator(operator.type)).toBe(true)
    }
    expect(listCategories().map((item) => item.key)).toEqual(
      expect.arrayContaining(builtinLibrary.categories.map((item) => item.key))
    )
  })

  it('getOperator throws on unknown type', () => {
    expect(() => getOperator('not-a-real-operator')).toThrow(/Unknown operator type/)
    expect(hasOperator('agent')).toBe(true)
    expect(hasOperator('Begin')).toBe(false)
  })

  it('getDefaultForm clones defaults and seeds branch examples', () => {
    const first = getDefaultForm('switch')
    const second = getDefaultForm('switch')
    const cases = first.cases as Array<{ id: string; label: string }>
    expect(cases).toHaveLength(1)
    expect(cases[0]?.id).toBeTruthy()
    expect(cases[0]?.id).not.toBe((second.cases as Array<{ id: string }>)[0]?.id)

    const cats = getDefaultForm('classifier').categories as Array<{ id: string }>
    expect(cats).toHaveLength(1)
    expect(cats[0]?.id).toBeTruthy()

    const session = getDefaultForm('session')
    expect(session.keepAlive).toBe(true)
    expect(session.model).toBe('deepseek-chat')
    expect(session).not.toHaveProperty('provider')
    expect(session).not.toHaveProperty('baseUrl')
    expect(session).not.toHaveProperty('apiKeyRef')
  })

  it('maps kinds to the 8 React Flow node types', () => {
    expect(getNodeTypeForKind('start')).toBe('startNode')
    expect(getNodeTypeForKind('end')).toBe('endNode')
    expect(getNodeTypeForKind('task')).toBe('taskNode')
    expect(getNodeTypeForKind('branch')).toBe('branchNode')
    expect(getNodeTypeForKind('container')).toBe('containerNode')
    expect(getNodeTypeForKind('loopStart')).toBe('loopStartNode')
    expect(getNodeTypeForKind('break')).toBe('breakNode')
    expect(getNodeTypeForKind('note')).toBe('noteNode')
    expect(getKindForNodeType('startNode')).toBe('start')
    expect(getKindForNodeType('containerNode')).toBe('container')
    expect(getKindForNodeType('unknown')).toBeUndefined()
  })

  it('computes source/target handles from kind and form', () => {
    expect(getSourceHandles('http', {})).toEqual([{ id: 'start', label: 'start' }])
    expect(getSourceHandles('foreach', {})).toEqual([{ id: 'start', label: 'start' }])
    expect(getSourceHandles('loop-start', {})).toEqual([{ id: 'start', label: 'start' }])
    expect(getSourceHandles('end', {})).toEqual([])
    expect(getSourceHandles('break', {})).toEqual([])
    expect(getSourceHandles('note', {})).toEqual([])
    expect(getSourceHandles('approval', {})).toEqual([
      { id: 'approved', label: 'approved' },
      { id: 'rejected', label: 'rejected' }
    ])

    const switchHandles = getSourceHandles('switch', {
      cases: [{ id: 'c1', label: 'Yes', expression: 'x' }]
    })
    expect(switchHandles.map((item) => item.id)).toEqual(['c1', 'else'])

    const classifierHandles = getSourceHandles('classifier', {
      categories: [{ id: 'cat1', name: 'A', description: '' }]
    })
    expect(classifierHandles.map((item) => item.id)).toEqual(['cat1'])

    expect(getTargetHandles('start')).toEqual([])
    expect(getTargetHandles('note')).toEqual([])
    expect(getTargetHandles('agent')).toEqual([{ id: 'end', label: 'end' }])
  })

  it('registers dataset in the data category with fields-derived outputs', () => {
    expect(listCategories().some((item) => item.key === 'data')).toBe(true)
    expect(listOperatorsByCategory('data').some((item) => item.type === 'dataset')).toBe(true)
    expect(listPaletteByCategory('data', []).some((item) => item.type === 'dataset')).toBe(true)

    const def = getOperator('dataset')
    expect(def.category).toBe('data')
    expect(def.kind).toBe('task')
    expect(def.icon).toBe('Database')
    expect(def.params.map((item) => item.key)).toEqual([
      'data_type',
      'source',
      'fields',
      'inline_data',
      'path',
      'url',
      'upstream_ref',
      'format',
      'description',
      'sample_limit'
    ])
    expect(def.outputs.map((item) => [item.name, item.type])).toEqual([
      ['data', 'array'],
      ['count', 'number'],
      ['schema', 'object']
    ])
    expect(def.outputs.every((item) => (item.description ?? '').length > 0)).toBe(true)
    expect(def.constraints).toEqual({ allowRoot: true, outputsFromParam: 'fields' })

    expect(getDefaultForm('dataset')).toMatchObject({
      data_type: 'table',
      source: 'inline',
      fields: [],
      format: 'json',
      sample_limit: 20
    })
    expect(getSourceHandles('dataset', {})).toEqual([{ id: 'start', label: 'start' }])
    expect(getTargetHandles('dataset')).toEqual([{ id: 'end', label: 'end' }])
  })
})
