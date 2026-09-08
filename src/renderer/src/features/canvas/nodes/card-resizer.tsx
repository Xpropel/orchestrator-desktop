import type { CSSProperties, JSX } from 'react'
import { NodeResizer } from '@xyflow/react'

/** 开始 / 结束 / 跳出这类胶囊节点的最小尺寸 */
export const PILL_MIN_WIDTH = 96
export const PILL_MIN_HEIGHT = 36

/** 选中时在卡片四角 / 四边显示拉伸把手；尺寸落到节点的 width / height，随文档保存。 */
export function CardResizer({
  selected,
  minWidth,
  minHeight
}: {
  selected: boolean
  minWidth: number
  minHeight: number
}): JSX.Element {
  return <NodeResizer isVisible={selected} minWidth={minWidth} minHeight={minHeight} color="var(--accent)" />
}

/**
 * 节点没有显式尺寸时用默认宽度（或按内容收缩）；用户拉伸过后 React Flow 会把 width/height 写到节点外框上，
 * 这时卡片撑满外框。
 */
export function cardBoxStyle(
  width: number | undefined,
  height: number | undefined,
  fallbackWidth?: number
): CSSProperties {
  return {
    width: width != null ? '100%' : fallbackWidth,
    height: height != null ? '100%' : undefined
  }
}
