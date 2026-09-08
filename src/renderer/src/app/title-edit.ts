export function committedTitle(draft: string): string {
  return draft.trim() || 'Untitled'
}

let flush: (() => void) | null = null

/** 工具栏标题编辑中：保存 / 新建 / 打开前先提交草稿，避免落盘旧标题。 */
export function registerTitleEditFlush(handler: (() => void) | null): void {
  flush = handler
}

export function flushPendingTitleEdit(): void {
  flush?.()
}
