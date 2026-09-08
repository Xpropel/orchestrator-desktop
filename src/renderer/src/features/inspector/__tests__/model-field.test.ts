import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ParamField } from '@/core/schema'
import { ModelField } from '../fields/model-field'

const field: ParamField = { key: 'model', label: '模型', type: 'model', required: true }

function render(value: unknown, onChange = vi.fn()): string {
  return renderToStaticMarkup(
    createElement(ModelField, {
      nodeId: 'session:1',
      field,
      value,
      form: { model: value },
      onChange
    })
  )
}

describe('ModelField', () => {
  it('renders the placeholder when empty', () => {
    const html = render('')
    expect(html).toContain('选择模型')
    expect(html).toContain('data-testid="model-field-trigger"')
    expect(html).toContain('deepseek-chat')
    expect(html).toContain('qwen-plus')
    expect(html).toContain('自定义模型名…')
  })

  it('shows icon plus preset id for a known model', () => {
    const html = render('qwen-plus')
    expect(html).toContain('qwen-plus')
    expect(html).toContain('#605BEC')
    expect(html).not.toContain('选择模型')
    expect(html).toContain('data-testid="model-option-deepseek-chat"')
  })

  it('switches to a text input for a custom model name', () => {
    const html = render('my-local-llm')
    expect(html).toContain('data-testid="model-field-custom-input"')
    expect(html).toContain('my-local-llm')
    expect(html).toContain('从预设选择')
    expect(html).not.toContain('data-testid="model-field-trigger"')
  })
})
