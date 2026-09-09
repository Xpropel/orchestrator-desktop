import { app, type BrowserWindow, type RenderProcessGoneDetails } from 'electron'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSmoke } from './smoke-env'

export const MAX_RENDERER_RELOADS = 2

const RELOAD_REASONS = new Set(['crashed', 'oom', 'abnormal-exit', 'launch-failed'])

export function shouldReloadRenderer(reason: string): boolean {
  return RELOAD_REASONS.has(reason)
}

function logFile(): string {
  return join(app.getPath('userData'), 'main.log')
}

export function logMain(message: string, extra?: unknown): void {
  const line = extra === undefined ? message : `${message} ${JSON.stringify(extra)}`
  const text = `[${new Date().toISOString()}] ${line}\n`
  try {
    appendFileSync(logFile(), text)
  } catch {
    // 日志失败不能再拖垮主进程。
  }
  console.error(text.trimEnd())
}

/** 渲染进程崩了时重载窗口，避免测试中途整窗消失。冒烟模式交给 smoke hook 退出。 */
export function attachRendererWatchdog(win: BrowserWindow): void {
  if (isSmoke()) {
    return
  }

  let reloads = 0

  win.webContents.on('render-process-gone', (_event, details: RenderProcessGoneDetails) => {
    logMain('render-process-gone', { reason: details.reason, exitCode: details.exitCode })
    if (win.isDestroyed() || !shouldReloadRenderer(details.reason)) {
      return
    }
    if (reloads >= MAX_RENDERER_RELOADS) {
      logMain('renderer reload skipped', { reloads })
      return
    }
    reloads += 1
    logMain('reloading renderer', { reloads })
    win.webContents.reload()
  })

  win.on('unresponsive', () => {
    logMain('window unresponsive')
  })
}
