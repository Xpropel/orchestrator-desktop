import { APP_TITLE, formatWindowTitle } from '../../shared/window-title'

export { APP_TITLE }

export const appState = {
  dirty: false,
  ignoreCloseGuard: false,
  /** Cmd+Q / 菜单「退出」会先发 before-quit；关窗后若仍为 true 则真正退出。 */
  quitRequested: false,
  /** 当前流程标题，由渲染进程同步；空串表示未知。 */
  documentTitle: '',
  /** 当前已命名文件路径；未命名为空串。用于 macOS 代理图标与脏点。 */
  filePath: ''
}

/** 窗口标题：`流程标题 * — Orchestrator Desktop`。 */
export function windowTitle(): string {
  return formatWindowTitle(appState.documentTitle, appState.dirty)
}
