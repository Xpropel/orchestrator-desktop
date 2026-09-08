export const appState = {
  dirty: false,
  ignoreCloseGuard: false,
  /** 当前流程标题，由渲染进程同步；空串表示未知。 */
  documentTitle: ''
}

export const APP_TITLE = 'Orchestrator Desktop'

/** 窗口标题：`流程标题 * — Orchestrator Desktop`。 */
export function windowTitle(): string {
  const marker = appState.dirty ? ' *' : ''
  return appState.documentTitle ? `${appState.documentTitle}${marker} — ${APP_TITLE}` : `${APP_TITLE}${marker}`
}
