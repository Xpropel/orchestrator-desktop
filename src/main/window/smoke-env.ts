import { app } from 'electron'

export function isSmoke(): boolean {
  return !app.isPackaged && process.env.ORCH_SMOKE === '1'
}

export function smokeExamples(): boolean {
  return isSmoke() && process.env.ORCH_SMOKE_EXAMPLES === '1'
}

export function isDevRenderer(): boolean {
  return !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL)
}

export function remoteDebugPort(): string | undefined {
  if (app.isPackaged) return undefined
  return process.env.ORCH_REMOTE_DEBUG
}
