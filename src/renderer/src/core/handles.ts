export const HANDLE_START = 'start'
export const HANDLE_END = 'end'
export const HANDLE_ELSE = 'else'
export const HANDLE_APPROVED = 'approved'
export const HANDLE_REJECTED = 'rejected'
export const HANDLE_START_NEW = `${HANDLE_START}#new`

/** 画布物理源 handle，例如 `start#1`。 */
export function physicalSourceHandle(logical: string, rank: number): string {
  return `${logical}#${rank}`
}

/** 去掉 `#` 及其后部分；`null` / `undefined` 原样返回。 */
export function logicalHandleId(id: string | null | undefined): string | null | undefined {
  if (id == null) return id
  const hash = id.indexOf('#')
  return hash === -1 ? id : id.slice(0, hash)
}

export function isLogicalStartHandle(id: string | null | undefined): boolean {
  return (logicalHandleId(id) ?? HANDLE_START) === HANDLE_START
}
