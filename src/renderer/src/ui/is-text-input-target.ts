import { isEditableInputType, TEXT_INPUT_SELECTOR } from '@shared/text-input'

export function isTextInputTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined') return false
  const el =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null
  if (!el) return false
  const match = el.closest(TEXT_INPUT_SELECTOR)
  if (!match) return false
  if (match.tagName === 'INPUT') {
    const type = 'type' in match && typeof match.type === 'string' ? match.type : 'text'
    return isEditableInputType(type)
  }
  return true
}
