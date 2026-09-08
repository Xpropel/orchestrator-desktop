import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    addRecentDocument: () => undefined
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => []
  }
}))

import {
  enqueueOpenPath,
  flowPathsFromArgv,
  isFlowOpenPath,
  resetOpenPathQueue,
  takePendingOpenPath
} from '../open-file'

describe('open-file queue', () => {
  it('accepts flow json paths and keeps the last pending file', () => {
    resetOpenPathQueue()
    expect(isFlowOpenPath('/tmp/a.flow.json')).toBe(true)
    expect(isFlowOpenPath('/tmp/notes.txt')).toBe(false)
    enqueueOpenPath('/tmp/one.flow.json')
    enqueueOpenPath('/tmp/two.flow.json')
    expect(takePendingOpenPath()).toBe('/tmp/two.flow.json')
    expect(takePendingOpenPath()).toBeNull()
  })

  it('reads json paths from argv after the script name', () => {
    expect(
      flowPathsFromArgv(['electron', '.', '/tmp/demo.flow.json', '--inspect', '/tmp/skip.txt'], false)
    ).toEqual(['/tmp/demo.flow.json'])
    expect(flowPathsFromArgv(['Orchestrator Desktop', '/tmp/demo.json'], true)).toEqual(['/tmp/demo.json'])
  })
})
