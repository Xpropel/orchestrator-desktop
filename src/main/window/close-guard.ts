import { BrowserWindow, dialog } from 'electron'
import type { SaveResult } from '../../preload/index.d'
import { clearRecovery } from '../ipc/recovery-store'
import { appState } from './app-state'
import { promptUnsaved } from './unsaved-dialog'
import { applyTitle } from './title'

export type SaveWaitResult = SaveResult | 'timeout' | 'failed'

type Pending = {
  timer: ReturnType<typeof setTimeout>
  resolve: (result: SaveWaitResult) => void
}

const SAVE_WAIT_MS = 60_000
let pending: Pending | null = null

export function failPendingSave(result: SaveWaitResult = 'failed'): void {
  if (!pending) {
    return
  }
  clearTimeout(pending.timer)
  const { resolve } = pending
  pending = null
  resolve(result)
}

export function waitForRendererSaveResult(timeoutMs: number): Promise<SaveWaitResult> {
  if (pending) {
    failPendingSave('timeout')
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending = null
      resolve('timeout')
    }, timeoutMs)
    pending = { timer, resolve }
  })
}

export function reportRendererSaveResult(result: SaveResult): void {
  if (!pending) {
    return
  }
  failPendingSave(result)
}

export function isSaveResult(value: unknown): value is SaveResult {
  return value === 'saved' || value === 'cancelled' || value === 'failed'
}

export function attachCloseGuard(win: BrowserWindow): void {
  let guarding = false

  win.webContents.on('render-process-gone', () => {
    if (pending) {
      failPendingSave('failed')
      appState.dirty = true
    }
  })

  win.on('close', (event) => {
    if (appState.ignoreCloseGuard || !appState.dirty) {
      return
    }
    event.preventDefault()
    if (guarding) {
      return
    }
    guarding = true
    void (async () => {
      try {
        const choice = await promptUnsaved(win)
        if (choice === 'cancel' || win.isDestroyed()) {
          return
        }
        if (choice === 'save') {
          win.webContents.send('menu:action', 'save')
          const result = await waitForRendererSaveResult(SAVE_WAIT_MS)
          if (result !== 'saved') {
            appState.dirty = true
            appState.ignoreCloseGuard = false
            if (!win.isDestroyed()) {
              applyTitle(win)
              if (result === 'timeout') {
                await dialog.showMessageBox(win, {
                  type: 'warning',
                  title: '保存超时',
                  message: '保存超时，窗口未关闭。请重试保存后再关闭。'
                })
              }
            }
            return
          }
        } else {
          await clearRecovery()
        }
        appState.dirty = false
        appState.ignoreCloseGuard = true
        if (!win.isDestroyed()) {
          win.close()
        }
      } finally {
        guarding = false
      }
    })()
  })
}
