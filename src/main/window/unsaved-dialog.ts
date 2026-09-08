import { app, BrowserWindow, dialog } from 'electron'
import { ACTION_LABEL } from '../../shared/action-labels'
import type { UnsavedChoice } from '../../preload/index.d'

function autoUnsavedChoice(): UnsavedChoice | null {
  if (app.isPackaged) {
    return null
  }
  const choice = process.env.ORCH_AUTO_UNSAVED_CHOICE
  if (choice === 'save' || choice === 'discard' || choice === 'cancel') {
    return choice
  }
  return null
}

export async function promptUnsaved(
  win?: BrowserWindow | null,
  message?: string
): Promise<UnsavedChoice> {
  const auto = autoUnsavedChoice()
  if (auto) {
    return auto
  }
  const options: Electron.MessageBoxOptions = {
    type: 'question',
    buttons: [ACTION_LABEL.save, ACTION_LABEL.discard, ACTION_LABEL.cancel],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: '未保存的更改',
    message:
      typeof message === 'string' && message.length > 0
        ? message
        : '当前流程有未保存的更改，是否保存？'
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  if (response === 0) return 'save'
  if (response === 1) return 'discard'
  return 'cancel'
}
