import { Menu, app, dialog, type MenuItemConstructorOptions } from 'electron'
import { ACTION_LABEL } from '../../shared/action-labels'
import type { MenuAction } from '../../preload/index.d'
import type { ExampleMenuEntry } from '../ipc/examples'

function exampleSubmenu(
  send: (action: MenuAction) => void,
  examples: ExampleMenuEntry[]
): MenuItemConstructorOptions[] {
  if (examples.length === 0) {
    return [{ label: '（无内置示例）', enabled: false }]
  }
  return examples.map((example) => ({
    label: example.title,
    click: () => send(`example:${example.name}`)
  }))
}

export function createApplicationMenu(
  send: (action: MenuAction) => void,
  examples: ExampleMenuEntry[] = []
): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: ACTION_LABEL.new, accelerator: 'CommandOrControl+N', click: () => send('new') },
        { label: ACTION_LABEL.open, accelerator: 'CommandOrControl+O', click: () => send('open') },
        { label: ACTION_LABEL.openExample, submenu: exampleSubmenu(send, examples) },
        {
          label: ACTION_LABEL.importJson,
          accelerator: 'CommandOrControl+I',
          click: () => send('importJson')
        },
        { type: 'separator' },
        { label: ACTION_LABEL.save, accelerator: 'CommandOrControl+S', click: () => send('save') },
        {
          label: ACTION_LABEL.saveAs,
          accelerator: 'CommandOrControl+Shift+S',
          click: () => send('saveAs')
        },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit', label: process.platform === 'darwin' ? '关闭' : '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: ACTION_LABEL.undo, accelerator: 'CommandOrControl+Z', click: () => send('undo') },
        {
          label: ACTION_LABEL.redo,
          accelerator: 'CommandOrControl+Y',
          click: () => send('redo')
        },
        {
          label: ACTION_LABEL.redo,
          accelerator: 'CommandOrControl+Shift+Z',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => send('redo')
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { label: ACTION_LABEL.copy, accelerator: 'CommandOrControl+C', click: () => send('copy') },
        { label: ACTION_LABEL.paste, accelerator: 'CommandOrControl+V', click: () => send('paste') },
        {
          label: ACTION_LABEL.duplicate,
          accelerator: 'CommandOrControl+D',
          click: () => send('duplicate')
        },
        { label: ACTION_LABEL.delete, accelerator: 'Delete', click: () => send('delete') }
      ]
    },
    {
      label: '视图',
      submenu: [
        ...(!app.isPackaged
          ? ([
              { role: 'reload', label: '重新加载' },
              { role: 'toggleDevTools', label: '开发者工具' },
              { type: 'separator' }
            ] satisfies MenuItemConstructorOptions[])
          : []),
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { label: ACTION_LABEL.fitView, click: () => send('fitView') },
        { label: ACTION_LABEL.autoLayout, click: () => send('autoLayout') }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 Orchestrator Desktop',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: 'Orchestrator Desktop',
              detail: `版本 ${app.getVersion()}`
            })
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
