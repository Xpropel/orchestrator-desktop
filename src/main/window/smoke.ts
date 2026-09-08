import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { loadExampleManifest } from '../ipc/examples'
import { appState } from './app-state'
import { smokeExamples } from './smoke-env'

export function attachSmokeHooks(win: BrowserWindow): void {
  let failed = false
  win.webContents.on('console-message', (event, level, message) => {
    const eventLevel = event.level
    const text = event.message || (typeof message === 'string' ? message : '')
    if (eventLevel === 'error' || level === 3) {
      failed = true
      console.error('[smoke] renderer error:', text)
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    failed = true
    console.error('[smoke] render-process-gone', details.reason)
  })
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
  const capture = async (fileName: string): Promise<void> => {
    try {
      const image = await win.webContents.capturePage()
      const dir = join(process.cwd(), '.screenshots')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, fileName), image.toPNG())
      console.log('[smoke] captured', fileName)
    } catch (error) {
      failed = true
      console.error('[smoke] capture failed', fileName, error)
    }
  }

  win.webContents.on('did-finish-load', () => {
    void (async () => {
      await sleep(1500)
      await capture('smoke.png')
      if (smokeExamples()) {
        const examples = await loadExampleManifest()
        if (examples.length === 0) {
          failed = true
          console.error('[smoke] examples/index.json 为空或不可读')
        }
        for (const example of examples) {
          win.webContents.send('menu:action', `example:${example.name}`)
          await sleep(1500)
          if (appState.documentTitle !== example.title) {
            failed = true
            console.error(
              `[smoke] example "${example.name}" did not load: title is "${appState.documentTitle}", expected "${example.title}"`
            )
          } else {
            console.log(`[smoke] example "${example.name}" loaded`)
          }
          win.webContents.send('menu:action', 'fitView')
          await sleep(600)
          await capture(`smoke-example-${example.name}.png`)
        }
      }
      appState.ignoreCloseGuard = true
      app.exit(failed ? 1 : 0)
    })()
  })
}
