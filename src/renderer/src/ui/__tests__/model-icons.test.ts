import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeepSeekIcon, ModelProviderIcon, QwenIcon } from '../model-icons'

describe('model icons', () => {
  it('mounts DeepSeek and Qwen brand SVGs', () => {
    const deepseek = renderToStaticMarkup(createElement(DeepSeekIcon, { className: 'h-4 w-4' }))
    const qwen = renderToStaticMarkup(createElement(QwenIcon, { className: 'h-4 w-4' }))
    expect(deepseek).toContain('<svg')
    expect(deepseek).toContain('viewBox="0 0 1391 1024"')
    expect(deepseek).toContain('#4D6BFE')
    expect(qwen).toContain('<svg')
    expect(qwen).toContain('viewBox="0 0 1024 1024"')
    expect(qwen).toContain('#605BEC')
  })

  it('ModelProviderIcon uses brand icons or Cpu', () => {
    const ds = renderToStaticMarkup(createElement(ModelProviderIcon, { provider: 'deepseek' }))
    const qw = renderToStaticMarkup(createElement(ModelProviderIcon, { provider: 'qwen' }))
    const generic = renderToStaticMarkup(createElement(ModelProviderIcon, { provider: null }))
    expect(ds).toContain('#4D6BFE')
    expect(qw).toContain('#605BEC')
    expect(generic).toContain('<svg')
    expect(generic).not.toContain('#4D6BFE')
    expect(generic).not.toContain('#605BEC')
  })
})
