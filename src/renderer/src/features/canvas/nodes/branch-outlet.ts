import { cardChromeHeaderPx } from './card-metrics'

export const BRANCH_ROW_H = 32
/** 卡片 1px 顶边 + 出口列表 1px 顶边，与 NodeChrome / `<ul className="border-t">` 对齐。 */
export const BRANCH_OUTLET_NUDGE_PX = 2

export function branchOutletTop(index: number, hasModelBadge: boolean): number {
  return cardChromeHeaderPx(hasModelBadge) + BRANCH_OUTLET_NUDGE_PX + index * BRANCH_ROW_H + BRANCH_ROW_H / 2
}

/** 把屏幕坐标下的行中心换算成节点本地 `top`（已除掉 React Flow 缩放）。 */
export function measureRowCenterY(
  root: Pick<HTMLElement, 'getBoundingClientRect' | 'offsetHeight'>,
  row: Pick<HTMLElement, 'getBoundingClientRect'>
): number {
  const rootRect = root.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const scale = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1
  return (rowRect.top + rowRect.height / 2 - rootRect.top) / scale
}

export function outletTopsFromRows(
  root: Pick<HTMLElement, 'getBoundingClientRect' | 'offsetHeight'> | null,
  rows: Array<Pick<HTMLElement, 'getBoundingClientRect'> | null>,
  hasModelBadge: boolean
): number[] {
  return rows.map((row, index) =>
    root && row ? measureRowCenterY(root, row) : branchOutletTop(index, hasModelBadge)
  )
}
