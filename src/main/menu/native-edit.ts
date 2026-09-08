import type { MenuAction } from '../../preload/index.d'

export type NativeEditCommand = 'undo' | 'redo' | 'copy' | 'paste' | 'delete'

/** 菜单加速键在文本框内应改走 `webContents.copy/paste/…`，而不是画布动作。 */
export function nativeEditCommand(action: MenuAction): NativeEditCommand | null {
  if (
    action === 'undo' ||
    action === 'redo' ||
    action === 'copy' ||
    action === 'paste' ||
    action === 'delete'
  ) {
    return action
  }
  return null
}
