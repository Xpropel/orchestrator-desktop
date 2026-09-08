import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOperatorNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import { fileApi } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'
import {
  resetRecoveryRestoreGate,
  resetRecoveryWriteCache,
  restoreRecoveryIfPresent
} from '../crash-recovery'
import { loadFlowFromText, newFlow, saveFlow } from '../file-actions'

const fixtureDir = dirname(fileURLToPath(import.meta.url))
const templateText = readFileSync(join(fixtureDir, 'fixtures/ragflow-template.json'), 'utf8')

beforeAll(() => {
  loadLibrary()
})

describe('audit-files', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    resetRecoveryWriteCache()
    resetRecoveryRestoreGate()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    resetRecoveryRestoreGate()
    resetRecoveryWriteCache()
  })

  it('loadFlowFromText opens {title, dsl} and bare {nodes, edges} without partial state on bad JSON', () => {
    loadFlowFromText(templateText, null)
    expect(useFlowStore.getState().title).toBe('网页搜索助手')
    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(1)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'start')).toBe(true)

    const title = useFlowStore.getState().title
    expect(() => loadFlowFromText('{', null)).toThrow(/malformed JSON|不是合法/)
    expect(useFlowStore.getState().title).toBe(title)

    loadFlowFromText(
      JSON.stringify({
        nodes: [
          {
            id: 'start',
            type: 'startNode',
            position: { x: 0, y: 0 },
            data: { label: 'start', name: 'start', form: {} }
          }
        ],
        edges: []
      }),
      null
    )
    expect(useFlowStore.getState().nodes).toHaveLength(1)
    expect(useFlowStore.getState().filePath).toBeNull()
  })

  it('saveFlow does not treat concurrent edits as saved', async () => {
    useFlowStore.getState().addNode(
      createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes)
    )
    useFlowStore.getState().markSaved('C:/tmp/audit.flow.json')
    useFlowStore.getState().addNode(
      createOperatorNode('message', { x: 40, y: 40 }, useFlowStore.getState().nodes)
    )
    expect(useFlowStore.getState().dirty).toBe(true)

    vi.spyOn(fileApi, 'reportSaveResult').mockImplementation(() => undefined)
    vi.spyOn(fileApi, 'saveFlow').mockImplementation(async () => {
      useFlowStore.getState().addNode(
        createOperatorNode('code', { x: 80, y: 80 }, useFlowStore.getState().nodes)
      )
    })

    const ok = await saveFlow({ silent: true })
    expect(ok).toBe(true)
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'code')).toBe(true)
    useFlowStore.getState().undo()
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'code')).toBe(false)
    expect(useFlowStore.getState().dirty).toBe(false)
  })

  it('asks to restore only once when restoreRecoveryIfPresent is invoked twice', async () => {
    vi.spyOn(fileApi, 'readRecovery').mockResolvedValue({
      content: JSON.stringify({
        version: 1,
        title: 'Recovered',
        graph: {
          nodes: [
            {
              id: 'start',
              type: 'startNode',
              position: { x: 80, y: 240 },
              data: { label: 'start', name: 'start', form: {} }
            }
          ],
          edges: []
        },
        components: {},
        globals: {}
      }),
      filePath: null,
      savedAt: '2026-01-01T00:00:00.000Z'
    })
    const confirm = vi.fn(() => true)
    const first = restoreRecoveryIfPresent({ confirm, alert: () => undefined })
    const second = restoreRecoveryIfPresent({ confirm, alert: () => undefined })
    expect(await first).toBe('restored')
    expect(await second).toBe('restored')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useFlowStore.getState().dirty).toBe(true)
  })

  it('newFlow clears the recovery snapshot', async () => {
    const clear = vi.spyOn(fileApi, 'clearRecovery').mockResolvedValue(undefined)
    await newFlow()
    expect(clear).toHaveBeenCalled()
  })

  it('does not statically glob examples/private into the renderer module', () => {
    const src = readFileSync(join(fixtureDir, '../file-actions.ts'), 'utf8')
    expect(src).not.toMatch(/import\.meta\.glob\(\s*['"]@examples\/private/)
    expect(src).toMatch(/import\.meta\.env\.DEV/)
    expect(src).toMatch(/example-modules\.private/)
  })
})
