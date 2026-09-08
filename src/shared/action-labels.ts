export const ACTION_LABEL = {
  new: '新建',
  open: '打开…',
  openExample: '打开示例',
  save: '保存',
  saveAs: '另存为…',
  discard: '不保存',
  cancel: '取消',
  undo: '撤销',
  redo: '重做',
  copy: '复制',
  paste: '粘贴',
  duplicate: '克隆',
  delete: '删除',
  deleteNode: '删除节点',
  deleteEdge: '删除连线',
  fitView: '自适应视图',
  autoLayout: '自动布局',
  addNote: '添加便签',
  exportJson: '导出 JSON',
  importJson: '导入 JSON'
} as const

export const ACTION_SHORTCUT = {
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  duplicate: 'Ctrl+D',
  delete: 'Delete'
} as const

export function labeledShortcut(action: keyof typeof ACTION_SHORTCUT): string {
  return `${ACTION_LABEL[action]} (${ACTION_SHORTCUT[action]})`
}
