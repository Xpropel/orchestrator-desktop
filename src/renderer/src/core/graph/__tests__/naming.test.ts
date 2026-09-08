import { describe, expect, it } from 'vitest'
import { createNodeId } from '../naming'

describe('createNodeId', () => {
  it('generates type:xxxxxxxx ids', () => {
    expect(createNodeId('agent')).toMatch(/^agent:[\w-]{8}$/)
    expect(createNodeId('http')).toMatch(/^http:[\w-]{8}$/)
    expect(createNodeId('foreach')).toMatch(/^foreach:[\w-]{8}$/)
    expect(createNodeId('foo.bar')).toMatch(/^foo\.bar:[\w-]{8}$/)
  })
})
