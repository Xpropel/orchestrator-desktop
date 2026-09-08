import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, contentSecurityPolicyMeta } from '../csp'

describe('contentSecurityPolicy', () => {
  it('keeps production scripts locked to self', () => {
    const policy = contentSecurityPolicy(false)
    expect(policy).toMatch(/script-src 'self'(;|$)/)
    expect(policy).not.toMatch(/script-src [^;]*unsafe-inline/)
    expect(policy).not.toContain('unsafe-eval')
    expect(policy).toContain("connect-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("frame-src 'none'")
  })

  it('omits frame-ancestors from the meta policy', () => {
    const meta = contentSecurityPolicyMeta(false)
    expect(meta).not.toContain('frame-ancestors')
    expect(meta).toContain("object-src 'none'")
    expect(meta).toContain("frame-src 'none'")
  })

  it('allows Vite HMR preamble scripts in the electron-vite dev renderer', () => {
    const policy = contentSecurityPolicy(true)
    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(policy).toContain('ws://localhost:*')
  })
})
