import { describe, expect, it } from 'vitest'
import { Puzzle } from 'lucide-react'
import { ICON_NAME_SET } from '@/core/icons'
import { resolveIcon } from '@/ui/icons'

describe('resolveIcon', () => {
  it('returns a whitelisted icon and falls back to Puzzle', () => {
    expect(resolveIcon('Bot')).toBeTruthy()
    expect(resolveIcon('NotAnIcon')).toBe(Puzzle)
  })

  it('does not whitelist unused Download', () => {
    expect(ICON_NAME_SET.has('Download')).toBe(false)
    expect(ICON_NAME_SET.has('CloudDownload')).toBe(true)
  })
})
