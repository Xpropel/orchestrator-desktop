import { describe, expect, it } from 'vitest'
import {
  HANDLE_START,
  HANDLE_START_NEW,
  isLogicalStartHandle,
  logicalHandleId,
  physicalSourceHandle
} from '../handles'

describe('physicalSourceHandle', () => {
  it('writes start#rank', () => {
    expect(physicalSourceHandle(HANDLE_START, 1)).toBe('start#1')
    expect(physicalSourceHandle(HANDLE_START, 4)).toBe('start#4')
  })
})

describe('logicalHandleId', () => {
  it('returns null and undefined unchanged', () => {
    expect(logicalHandleId(null)).toBeNull()
    expect(logicalHandleId(undefined)).toBeUndefined()
  })

  it('strips # and the suffix', () => {
    expect(logicalHandleId('start')).toBe('start')
    expect(logicalHandleId('start#1')).toBe('start')
    expect(logicalHandleId(HANDLE_START_NEW)).toBe('start')
    expect(logicalHandleId('else')).toBe('else')
    expect(logicalHandleId('case-a#2')).toBe('case-a')
  })
})

describe('isLogicalStartHandle', () => {
  it('treats missing and physical start ports as start', () => {
    expect(isLogicalStartHandle(undefined)).toBe(true)
    expect(isLogicalStartHandle('start#3')).toBe(true)
    expect(isLogicalStartHandle('approved')).toBe(false)
  })
})
