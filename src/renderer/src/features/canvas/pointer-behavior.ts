/** 画布拖移：两端保留中键/右键；Mac 触控板另开双指滑动，空格拖动走 React Flow 默认。 */
export function canvasPointerBehavior(platform: NodeJS.Platform): {
  panOnScroll: boolean
  zoomOnScroll: boolean
  panOnScrollSpeed: number
  panOnDrag: number[]
  panActivationKeyCode: string
  zoomActivationKeyCode: string
} {
  const mac = platform === 'darwin'
  return {
    panOnScroll: mac,
    zoomOnScroll: !mac,
    panOnScrollSpeed: 1,
    panOnDrag: [1, 2],
    panActivationKeyCode: 'Space',
    zoomActivationKeyCode: mac ? 'Meta' : 'Control'
  }
}

export function canvasPanHint(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return '触控板双指滑动平移，捏合缩放；按住空格再拖动也可平移。⌘+双指滑动改为缩放。'
  }
  return '中键或右键拖动平移画布；滚轮缩放。'
}
