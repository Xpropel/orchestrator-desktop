import { isTextInputTarget } from './is-text-input-target'

export type TextFieldMenuBehavior = 'native-edit' | 'swallow' | 'forward'

export function textFieldMenuBehavior(action: string): TextFieldMenuBehavior {
  if (action === 'undo' || action === 'redo' || action === 'copy' || action === 'paste' || action === 'delete') {
    return 'native-edit'
  }
  if (action === 'duplicate' || action === 'fitView' || action === 'autoLayout') {
    return 'swallow'
  }
  return 'forward'
}

function runNativeEdit(command: 'undo' | 'redo' | 'copy' | 'paste' | 'delete'): boolean {
  try {
    return document.execCommand(command)
  } catch {
    return false
  }
}

/** 焦点在文本框时消费编辑类菜单动作，避免画布 undo/delete 抢走。 */
export function consumeTextInputAction(action: string): boolean {
  if (!isTextInputTarget(document.activeElement)) return false
  const behavior = textFieldMenuBehavior(action)
  if (behavior === 'forward') return false
  if (behavior === 'native-edit') {
    runNativeEdit(action as 'undo' | 'redo' | 'copy' | 'paste' | 'delete')
  }
  return true
}
