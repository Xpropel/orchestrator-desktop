import { describe, expect, it } from 'vitest'
import { splitTemplateSegments } from '../form-utils'

describe('splitTemplateSegments', () => {
  it('splits text and {{refs}} for highlight preview', () => {
    expect(splitTemplateSegments('hi {{A.b}}!')).toEqual([
      { kind: 'text', value: 'hi ' },
      { kind: 'ref', value: '{{A.b}}' },
      { kind: 'text', value: '!' }
    ])
  })
})
