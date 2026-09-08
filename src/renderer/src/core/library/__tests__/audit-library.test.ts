import { beforeAll, describe, expect, it } from 'vitest'
import { ICON_NAME_SET } from '../../icons'
import { builtinLibrary, loadLibrary } from '../index'
import { LLM_OPERATORS } from '../llm'
import { VAR_TYPES } from '../../schema'
import {
  getDefaultForm,
  getOperator,
  getSourceHandles,
  getTargetHandles,
  listCategories,
  listOperators
} from '../../registry'
import { operatorMatchesQuery } from '../../palette'
import { getNodeOutputs } from '../../variables'

beforeAll(() => {
  loadLibrary()
})

describe('audit library definitions', () => {
  it('keeps every select default inside its options', () => {
    for (const operator of listOperators()) {
      for (const field of operator.params) {
        if (field.type !== 'select' || field.default === undefined) continue
        const values = (field.options ?? []).map((item) => item.value)
        expect(values, `${operator.type}.${field.key}`).toContain(field.default)
      }
    }
  })

  it('points every showWhen key at a real param', () => {
    for (const operator of listOperators()) {
      const keys = new Set(operator.params.map((field) => field.key))
      for (const field of operator.params) {
        if (!field.showWhen) continue
        expect(keys.has(field.showWhen.key), `${operator.type}.${field.key} showWhen`).toBe(true)
      }
    }
  })

  it('keeps output names unique and types valid', () => {
    const allowed = new Set<string>(VAR_TYPES)
    for (const operator of listOperators()) {
      const names = operator.outputs.map((item) => item.name)
      expect(new Set(names).size, operator.type).toBe(names.length)
      for (const output of operator.outputs) {
        expect(allowed.has(output.type), `${operator.type}.${output.name}`).toBe(true)
      }
      for (const variable of operator.scopeVariables ?? []) {
        expect(allowed.has(variable.type), `${operator.type} scope ${variable.name}`).toBe(true)
      }
    }
  })

  it('resolves every operator and category icon against the whitelist', () => {
    for (const operator of listOperators()) {
      expect(ICON_NAME_SET.has(operator.icon), `${operator.type} icon ${operator.icon}`).toBe(true)
    }
    for (const category of listCategories()) {
      if (!category.icon) continue
      expect(ICON_NAME_SET.has(category.icon), `category ${category.key} icon ${category.icon}`).toBe(true)
    }
  })

  it('marks loop-start hidden and break onlyInsideContainer', () => {
    expect(getOperator('loop-start').constraints?.hidden).toBe(true)
    expect(getOperator('loop-start').kind).toBe('loopStart')
    expect(getOperator('break').constraints?.onlyInsideContainer).toBe(true)
    expect(getOperator('start').constraints?.allowRoot).toBe(true)
    expect(getOperator('start').constraints?.outputsFromParam).toBe('inputs')
    expect(getOperator('dataset').constraints?.allowRoot).toBe(true)
    expect(getOperator('dataset').constraints?.outputsFromParam).toBe('fields')
    expect(getOperator('if').constraints?.hasElseBranch).toBe(true)
    expect(getOperator('switch').constraints?.hasElseBranch).toBe(true)
    expect(getOperator('foreach').scopeVariables?.map((item) => item.name)).toEqual(['item', 'index'])
    expect(getOperator('while').scopeVariables?.map((item) => item.name)).toEqual(['index'])
    expect(getOperator('human-input').constraints?.outputsFromParam).toBe('fields')
    expect(getOperator('start').params.find((item) => item.key === 'inputs')?.hint).toBe(
      '声明后可被下游以 {{节点名.key}} 引用'
    )
    expect(getOperator('dataset').params.find((item) => item.key === 'fields')?.hint).toBe(
      '声明后可被下游以 {{节点名.key}} 引用'
    )
    expect(getOperator('human-input').params.find((item) => item.key === 'fields')?.hint).toBe(
      '声明后可被下游以 {{节点名.key}} 引用'
    )
  })

  it('derives human-input outputs from declared fields while keeping values', () => {
    const outputs = getNodeOutputs({
      data: {
        label: 'human-input',
        name: 'Human_1',
        form: {
          prompt: '填表',
          fields: [
            { key: 'name', type: 'string', required: true, description: '姓名' },
            { key: 'age', type: 'number', required: false, description: '' }
          ]
        }
      }
    })
    expect(outputs.map((item) => item.name)).toEqual(['values', 'name', 'age'])
    expect(outputs.find((item) => item.name === 'values')?.type).toBe('object')
    expect(outputs.find((item) => item.name === 'name')).toEqual({
      name: 'name',
      type: 'string',
      description: '姓名'
    })
    expect(outputs.find((item) => item.name === 'age')?.type).toBe('number')
  })

  it('requires list map/filter expressions and text joinWith only when visible', () => {
    const list = getOperator('list-operation')
    expect(list.params.find((item) => item.key === 'expression')?.showWhen).toEqual({
      key: 'operation',
      equals: 'map'
    })
    expect(list.params.find((item) => item.key === 'filterExpression')?.showWhen).toEqual({
      key: 'operation',
      equals: 'filter'
    })
    expect(getOperator('text-operation').params.find((item) => item.key === 'joinWith')).toMatchObject({
      default: ',',
      required: true,
      showWhen: { key: 'operation', equals: 'join' }
    })
  })

  it('includes every builtin and llm operator in the loaded library', () => {
    const types = new Set(listOperators().map((item) => item.type))
    for (const operator of [...builtinLibrary.operators, ...LLM_OPERATORS]) {
      expect(types.has(operator.type)).toBe(true)
    }
  })
})

describe('audit registry', () => {
  it('deep-clones object and array defaults between nodes', () => {
    const first = getDefaultForm('http')
    const second = getDefaultForm('http')
    expect(first.headers).not.toBe(second.headers)
    expect(first.query).not.toBe(second.query)
    ;(first.headers as Record<string, string>).Authorization = 'x'
    expect(second.headers).toEqual({})

    const retrievalA = getDefaultForm('retrieval')
    const retrievalB = getDefaultForm('retrieval')
    expect(retrievalA.datasets).not.toBe(retrievalB.datasets)
    ;(retrievalA.datasets as string[]).push('kb')
    expect(retrievalB.datasets).toEqual([])
  })

  it('builds a default form for custom without throwing', () => {
    expect(getDefaultForm('custom')).toEqual({})
    expect(getSourceHandles('custom', {})).toEqual([{ id: 'start', label: 'start' }])
    expect(getTargetHandles('custom')).toEqual([{ id: 'end', label: 'end' }])
  })

  it('returns no target handles for start and loop-start', () => {
    expect(getTargetHandles('start')).toEqual([])
    expect(getTargetHandles('loop-start')).toEqual([])
    expect(getTargetHandles('note')).toEqual([])
  })

  it('stabilizes switch handles when case ids are empty or duplicated', () => {
    const form = {
      cases: [
        { id: '', label: 'A', expression: '1' },
        { id: 'c1', label: 'B', expression: '2' },
        { id: 'c1', label: 'C', expression: '3' },
        { id: 'else', label: 'Named else', expression: '4' }
      ]
    }
    const first = getSourceHandles('switch', form).map((item) => item.id)
    const second = getSourceHandles('switch', form).map((item) => item.id)
    expect(first).toEqual(second)
    expect(new Set(first).size).toBe(first.length)
    expect(first.at(-1)).toBe('else')
    expect(first).toContain('c1')
  })
})

describe('audit palette search', () => {
  it('matches title, type, description, category key, and Chinese category title', () => {
    const agent = getOperator('agent')
    expect(operatorMatchesQuery(agent, 'Agent')).toBe(true)
    expect(operatorMatchesQuery(agent, 'agent')).toBe(true)
    expect(operatorMatchesQuery(agent, 'llm')).toBe(true)
    expect(operatorMatchesQuery(agent, '大模型')).toBe(true)
    expect(operatorMatchesQuery(getOperator('foreach'), '循环')).toBe(true)
    expect(operatorMatchesQuery(getOperator('if'), '逻辑控制')).toBe(true)
    expect(operatorMatchesQuery(agent, 'zzzz-nope')).toBe(false)
  })
})
