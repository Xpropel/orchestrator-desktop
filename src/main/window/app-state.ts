import { APP_TITLE, formatWindowTitle } from '../../shared/window-title'

export { APP_TITLE }

export const appState = {
  dirty: false,
  ignoreCloseGuard: false,
  /** 当前流程标题，由渲染进程同步；空串表示未知。 */
  documentTitle: ''
}

/** 窗口标题：`流程标题 * — Orchestrator Desktop`。 */
export function windowTitle(): string {
  return formatWindowTitle(appState.documentTitle, appState.dirty)
}
