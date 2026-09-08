export const CARD_DEFAULT_WIDTH = 240
export const CARD_MIN_WIDTH = 200
/** 色条 + 标题两行；再矮会裁掉型号行或出口第一行。 */
export const CARD_MIN_HEIGHT = 80
/** 色条 h-1 + 固定 h-12 标题行，与 BranchNode 出口 top 对齐。 */
export const CARD_CHROME_HEADER_PX = 52
export const CARD_MODEL_BADGE_PX = 22

export function cardChromeHeaderPx(hasModelBadge: boolean): number {
  return CARD_CHROME_HEADER_PX + (hasModelBadge ? CARD_MODEL_BADGE_PX : 0)
}
