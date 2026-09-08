import { isTextInputTarget } from './is-text-input-target'

function runNativeEdit(command: 'undo' | 'redo' | 'copy' | 'paste' | 'delete'): boolean {
  return document.execCommand(command)
}

/** 焦点在文本框时消费编辑类菜单动作，避免画布 undo/delete 抢走。 */
export function consumeTextInputAction(action: string): boolean {
  if (!isTextInputTarget(document.activeElement)) return false
  if (action === 'undo' || action === 'redo' || action === 'copy' || action === 'paste') {
    runNativeEdit(action)
    return true
  }
  if (action === 'delete') {
    runNativeEdit('delete')
    return true
  }
  return action === 'duplicate' || action === 'fitView' || action === 'autoLayout'
}
