export const APP_TITLE = 'Orchestrator Desktop'

/** 窗口 / 浏览器标签标题：`Untitled * — Orchestrator Desktop`。 */
export function formatWindowTitle(documentTitle: string, dirty: boolean): string {
  const marker = dirty ? ' *' : ''
  const name = documentTitle.trim()
  return name ? `${name}${marker} — ${APP_TITLE}` : `${APP_TITLE}${marker}`
}
