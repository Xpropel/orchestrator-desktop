import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const userData = join(tmpdir(), `orch-audit-main-${process.pid}`)

vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    isPackaged: false,
    getVersion: () => '0.0.0',
    getAppPath: () => userData,
    addRecentDocument: () => undefined
  },
  BrowserWindow: {
    fromWebContents: () => null,
    getFocusedWindow: () => null,
    getAllWindows: () => []
  },
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  Menu: {
    buildFromTemplate: () => ({}),
    setApplicationMenu: () => undefined
  },
  shell: { openExternal: vi.fn() }
}))

import { allowPath, isPathAllowed, resetAllowedPaths } from '../allowed-paths'
import { normalizePath } from '../normalize-path'
import { isAllowedExternalUrl, isAllowedFileNavigation } from '../navigation'
import { addRecentFile, getRecentFiles, MAX_RECENT } from '../../ipc/recent'
import { clearRecovery, readRecovery, writeRecovery } from '../../ipc/recovery-store'
import { persistRecoveryRecord } from '../../ipc/recovery'
import { appState, windowTitle } from '../../window/app-state'
import {
  failPendingSave,
  isSaveResult,
  reportRendererSaveResult,
  waitForRendererSaveResult
} from '../../window/close-guard'
import { nativeEditCommand } from '../../menu/native-edit'
import { formatWindowTitle } from '../../../shared/window-title'

beforeEach(() => {
  mkdirSync(userData, { recursive: true })
  resetAllowedPaths()
  appState.dirty = false
  appState.documentTitle = ''
  appState.filePath = ''
  appState.ignoreCloseGuard = false
  appState.quitRequested = false
  failPendingSave('failed')
})

afterEach(async () => {
  failPendingSave('failed')
  await clearRecovery()
  resetAllowedPaths()
  rmSync(userData, { recursive: true, force: true })
})

describe('window title', () => {
  it('formats Untitled dirty the way the window chrome shows it', () => {
    expect(formatWindowTitle('Untitled', true)).toBe('Untitled * — Orchestrator Desktop')
    appState.documentTitle = 'Untitled'
    appState.dirty = true
    expect(windowTitle()).toBe('Untitled * — Orchestrator Desktop')
  })
})

describe('file navigation guard', () => {
  const rendererIndex = join(userData, 'out', 'renderer', 'index.html')

  it('rejects an arbitrary file:// index.html that would keep preload/IPC', () => {
    expect(isAllowedFileNavigation('file:///C:/evil/index.html', rendererIndex)).toBe(false)
    expect(
      isAllowedFileNavigation(pathToFileURL(join(userData, 'evil', 'renderer', 'index.html')).href, rendererIndex)
    ).toBe(false)
  })

  it('allows only the app renderer index after path normalization', () => {
    expect(isAllowedFileNavigation(pathToFileURL(rendererIndex).href, rendererIndex)).toBe(true)
  })

  it('blocks javascript and file open-external, allows https', () => {
    expect(isAllowedExternalUrl('https://example.com/x', false)).toBe(true)
    expect(isAllowedExternalUrl('http://localhost:5173', true)).toBe(true)
    expect(isAllowedExternalUrl('http://localhost:5173', false)).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)', true)).toBe(false)
    expect(isAllowedExternalUrl('file:///C:/tmp/x', true)).toBe(false)
  })
})

describe('path whitelist', () => {
  it('collapses .. and Windows case so dialog paths match later reads', () => {
    const file = join(userData, 'demo.flow.json')
    writeFileSync(file, '{}', 'utf8')
    allowPath(file)
    expect(isPathAllowed(join(userData, 'sub', '..', 'demo.flow.json'))).toBe(true)
    expect(isPathAllowed(file.toUpperCase())).toBe(true)
    expect(isPathAllowed(join(userData, '..', 'secrets.json'))).toBe(false)
    expect(normalizePath(file)).toBe(normalizePath(file.toUpperCase()))
  })
})

describe('recent files', () => {
  it('drops missing files, dedupes case, and caps the list', () => {
    const files = Array.from({ length: 10 }, (_, index) => {
      const file = join(userData, `f${index}.flow.json`)
      writeFileSync(file, '{}', 'utf8')
      return file
    })
    const missing = join(userData, 'gone.flow.json')
    writeFileSync(
      join(userData, 'recent.json'),
      JSON.stringify([files[0], files[0].toUpperCase(), missing, ...files.slice(1)], null, 2),
      'utf8'
    )
    const recent = getRecentFiles()
    expect(recent).not.toContain(missing)
    expect(recent.length).toBeLessThanOrEqual(MAX_RECENT)
    const keys = recent.map((item) => normalizePath(item))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not throw when the recent list cannot be written', () => {
    rmSync(userData, { recursive: true, force: true })
    expect(() => addRecentFile(join(userData, 'x.flow.json'))).not.toThrow()
  })
})

describe('close-guard save wait', () => {
  it('recognizes renderer save results', () => {
    expect(isSaveResult('saved')).toBe(true)
    expect(isSaveResult('cancelled')).toBe(true)
    expect(isSaveResult('failed')).toBe(true)
    expect(isSaveResult('timeout')).toBe(false)
  })

  it('resolves a pending wait when the renderer is gone so close is not stuck', async () => {
    const pending = waitForRendererSaveResult(60_000)
    failPendingSave('failed')
    await expect(pending).resolves.toBe('failed')
  })

  it('treats Save-As cancelled as not saved', async () => {
    const pending = waitForRendererSaveResult(5_000)
    reportRendererSaveResult('cancelled')
    await expect(pending).resolves.toBe('cancelled')
  })
})

describe('recovery snapshot', () => {
  it('ignores a write after the document is clean', async () => {
    appState.dirty = true
    await persistRecoveryRecord({
      content: '{"ok":true}',
      filePath: null,
      savedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(await readRecovery()).not.toBeNull()

    appState.dirty = false
    await persistRecoveryRecord({
      content: '{"stale":true}',
      filePath: null,
      savedAt: '2026-01-02T00:00:00.000Z'
    })
    const record = await readRecovery()
    expect(record?.content).toBe('{"ok":true}')

    await clearRecovery()
    await persistRecoveryRecord({
      content: '{"stale":true}',
      filePath: null,
      savedAt: '2026-01-02T00:00:00.000Z'
    })
    expect(await readRecovery()).toBeNull()
  })

  it('clears if dirty flips false during an in-flight write', async () => {
    appState.dirty = true
    const write = persistRecoveryRecord({
      content: '{"late":true}',
      filePath: null,
      savedAt: '2026-01-03T00:00:00.000Z'
    })
    appState.dirty = false
    await write
    expect(await readRecovery()).toBeNull()
  })

  it('serializes write then clear so the file does not reappear', async () => {
    appState.dirty = true
    const write = writeRecovery({
      content: '{"race":true}',
      filePath: null,
      savedAt: '2026-01-04T00:00:00.000Z'
    })
    const clear = clearRecovery()
    await Promise.all([write, clear])
    expect(await readRecovery()).toBeNull()
  })
})

describe('menu native edit', () => {
  it('maps canvas-stealing accelerators to webContents edit commands', () => {
    expect(nativeEditCommand('copy')).toBe('copy')
    expect(nativeEditCommand('paste')).toBe('paste')
    expect(nativeEditCommand('undo')).toBe('undo')
    expect(nativeEditCommand('delete')).toBe('delete')
    expect(nativeEditCommand('save')).toBeNull()
    expect(nativeEditCommand('duplicate')).toBeNull()
  })
})

describe('packaging', () => {
  it('excludes examples/private from the asar file glob', () => {
    const yml = readFileSync(join(__dirname, '../../../../electron-builder.yml'), 'utf8')
    expect(yml).toContain('examples/**/*')
    expect(yml).toContain('!examples/private/**')
    expect(yml).toContain('!private/**')
  })

  it('packages macOS for Apple Silicon only', () => {
    const yml = readFileSync(join(__dirname, '../../../../electron-builder.yml'), 'utf8')
    expect(yml).toContain('arm64')
    expect(yml).not.toContain('x64')
    expect(yml).not.toContain('universal')
  })
})
