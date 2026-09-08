import { Menu, app, dialog, shell, type MenuItemConstructorOptions } from 'electron'
import { ACTION_LABEL } from '../../shared/action-labels'
import { APP_TITLE } from '../../shared/window-title'
import { isMacPlatform } from '../../shared/platform'
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

function showAbout(): void {
  void dialog.showMessageBox({
    type: 'info',
    title: '关于',
    message: APP_TITLE,
    detail: `版本 ${app.getVersion()}`
  })
}

function macAppMenu(): MenuItemConstructorOptions {
  return {
    label: APP_TITLE,
    submenu: [
      { label: `关于 ${APP_TITLE}`, click: () => showAbout() },
      { type: 'separator' },
      { role: 'services', label: '服务' },
      { type: 'separator' },
      { role: 'hide', label: `隐藏 ${APP_TITLE}` },
      { role: 'hideOthers', label: '隐藏其他' },
      { role: 'unhide', label: '全部显示' },
      { type: 'separator' },
      { role: 'quit', label: `退出 ${APP_TITLE}` }
    ]
  }
}

export function applicationMenuTemplate(
  send: (action: MenuAction) => void,
  examples: ExampleMenuEntry[] = [],
  platform: NodeJS.Platform = process.platform
): MenuItemConstructorOptions[] {
  const mac = isMacPlatform(platform)
  const template: MenuItemConstructorOptions[] = []

  if (mac) {
    template.push(macAppMenu())
  }

  template.push(
    {
      label: '文件',
      submenu: [
        { label: ACTION_LABEL.new, accelerator: 'CommandOrControl+N', click: () => send('new') },
        { label: ACTION_LABEL.open, accelerator: 'CommandOrControl+O', click: () => send('open') },
        ...(mac
          ? ([
              {
                label: '打开最近的文件',
                role: 'recentDocuments',
                submenu: [{ label: '清除记录', role: 'clearRecentDocuments' }]
              }
            ] satisfies MenuItemConstructorOptions[])
          : []),
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
        { role: mac ? 'close' : 'quit', label: mac ? '关闭' : '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: ACTION_LABEL.undo, accelerator: 'CommandOrControl+Z', click: () => send('undo') },
        {
          label: ACTION_LABEL.redo,
          accelerator: mac ? 'CommandOrControl+Shift+Z' : 'CommandOrControl+Y',
          click: () => send('redo')
        },
        {
          label: ACTION_LABEL.redo,
          accelerator: mac ? 'CommandOrControl+Y' : 'CommandOrControl+Shift+Z',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => send('redo')
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { label: ACTION_LABEL.copy, accelerator: 'CommandOrControl+C', click: () => send('copy') },
        { label: ACTION_LABEL.paste, accelerator: 'CommandOrControl+V', click: () => send('paste') },
        { role: 'selectAll', label: '全选' },
        {
          label: ACTION_LABEL.duplicate,
          accelerator: 'CommandOrControl+D',
          click: () => send('duplicate')
        },
        { label: ACTION_LABEL.delete, accelerator: 'Delete', click: () => send('delete') },
        ...(mac
          ? ([
              {
                label: ACTION_LABEL.delete,
                accelerator: 'Backspace',
                visible: false,
                acceleratorWorksWhenHidden: true,
                click: () => send('delete')
              }
            ] satisfies MenuItemConstructorOptions[])
          : [])
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
        { label: ACTION_LABEL.autoLayout, click: () => send('autoLayout') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '进入全屏幕' }
      ]
    }
  )

  if (mac) {
    template.push({
      label: '窗口',
      role: 'window',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '全部置于顶层' }
      ]
    })
  }

  template.push({
    label: '帮助',
    submenu: [
      ...(!mac
        ? ([
            {
              label: `关于 ${APP_TITLE}`,
              click: () => showAbout()
            }
          ] satisfies MenuItemConstructorOptions[])
        : []),
      {
        label: '项目主页',
        click: () => {
          void shell.openExternal('https://github.com/Xpropel/orchestrator-desktop')
        }
      }
    ]
  })

  return template
}

export function createApplicationMenu(
  send: (action: MenuAction) => void,
  examples: ExampleMenuEntry[] = []
): Menu {
  return Menu.buildFromTemplate(applicationMenuTemplate(send, examples))
}
