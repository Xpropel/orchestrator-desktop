/** 这些 `<input type>` 不是打字控件：Delete / Ctrl+C 应仍走画布命令。 */
export const NON_TEXT_INPUT_TYPES = [
  'button',
  'checkbox',
  'radio',
  'file',
  'reset',
  'submit',
  'image',
  'hidden',
  'range',
  'color'
] as const

export function isEditableInputType(type: string): boolean {
  return !NON_TEXT_INPUT_TYPES.includes(type.toLowerCase() as (typeof NON_TEXT_INPUT_TYPES)[number])
}

export const TEXT_INPUT_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]'

/**
 * 在页面里判断 `document.activeElement` 是否为可编辑控件。
 * 供主进程 `webContents.executeJavaScript` 使用（无用户手势时 `execCommand` 不可靠）。
 */
export const EDITABLE_FIELD_JS = `(() => {
  const el = document.activeElement;
  if (!el || !el.closest) return false;
  const match = el.closest(${JSON.stringify(TEXT_INPUT_SELECTOR)});
  if (!match) return false;
  if (match.tagName === 'INPUT') {
    const type = String(match.type || 'text').toLowerCase();
    const blocked = ${JSON.stringify(NON_TEXT_INPUT_TYPES)};
    return !blocked.includes(type);
  }
  return true;
})()`
