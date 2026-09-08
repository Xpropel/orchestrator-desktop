import type { OperatorDefinition } from '../schema'
import { LLM, op } from './define'

export const LLM_OPERATORS: OperatorDefinition[] = [
  op(
    'session',
    'Session',
    '创建一条模型会话。同一会话可被多个 agent 依次复用，避免重复传上下文',
    'MessagesSquare',
    LLM,
    'llm',
    'task',
    [
      { key: 'model', label: '模型', type: 'model', required: true, default: 'deepseek-chat' },
      { key: 'system', label: '系统提示词', type: 'template', hint: '随会话固定' },
      { key: 'temperature', label: '温度', type: 'slider', default: 0.7, min: 0, max: 2, step: 0.1 },
      { key: 'maxTokens', label: '最大 Tokens', type: 'number', min: 1 },
      { key: 'keepAlive', label: '保持上下文常驻', type: 'boolean', default: true },
      {
        key: 'cacheTtlSeconds',
        label: '缓存 TTL（秒）',
        type: 'number',
        min: 0,
        showWhen: { key: 'keepAlive', equals: true }
      },
      { key: 'historyWindow', label: '历史窗口', type: 'number', hint: '保留最近 N 轮，0 = 全部', default: 0, min: 0 }
    ],
    [{ name: 'session', type: 'session' }]
  ),
  op(
    'session-fork',
    'Session Fork',
    '从现有会话分叉一个副本：共享到此刻为止的上下文，之后互不影响',
    'GitFork',
    LLM,
    'llm',
    'task',
    [
      {
        key: 'source',
        label: '源会话',
        type: 'variable',
        required: true,
        extra: { accept: ['session'] }
      },
      { key: 'label', label: '标签', type: 'string' },
      { key: 'inheritHistory', label: '继承历史', type: 'boolean', default: true },
      { key: 'truncateToTurn', label: '只继承前 N 轮', type: 'number', min: 0, hint: '可选' }
    ],
    [{ name: 'session', type: 'session' }]
  ),
  op(
    'agent',
    'Agent',
    'LLM 调用主力。挂到会话则续写该会话上下文；不挂则临时会话',
    'Bot',
    LLM,
    'llm',
    'task',
    [
      {
        key: 'session',
        label: '会话',
        type: 'variable',
        hint: '可选。挂到已有会话可复用上下文',
        extra: { accept: ['session'] }
      },
      { key: 'model', label: '模型', type: 'model', hint: '未挂会话时必填' },
      { key: 'system', label: '系统提示词', type: 'template', hint: '未挂会话时可用' },
      { key: 'prompt', label: '提示词', type: 'template', required: true },
      { key: 'tools', label: '工具', type: 'stringList', default: [] },
      { key: 'maxSteps', label: '最大步数', type: 'number', default: 8, min: 1 },
      { key: 'structuredOutput', label: '结构化输出', type: 'json' }
    ],
    [
      { name: 'text', type: 'string' },
      { name: 'json', type: 'object' },
      { name: 'session', type: 'session' },
      { name: 'usage', type: 'object' }
    ]
  ),
  op(
    'prompt-template',
    'Prompt Template',
    '组装提示词片段，供 agent 引用',
    'FileText',
    LLM,
    'llm',
    'task',
    [{ key: 'template', label: '模板', type: 'template', required: true }],
    [{ name: 'text', type: 'string' }]
  ),
  op(
    'classifier',
    'Classifier',
    '将输入分类到预定义类别并按类分支',
    'Layers',
    LLM,
    'llm',
    'branch',
    [
      {
        key: 'session',
        label: '会话',
        type: 'variable',
        extra: { accept: ['session'] }
      },
      { key: 'input', label: '输入', type: 'variable', required: true },
      { key: 'categories', label: '类别', type: 'categories', required: true }
    ],
    [{ name: 'category', type: 'string' }]
  ),
  op(
    'parameter-extractor',
    'Parameter Extractor',
    '从文本中抽取结构化参数',
    'Braces',
    LLM,
    'llm',
    'task',
    [
      {
        key: 'session',
        label: '会话',
        type: 'variable',
        extra: { accept: ['session'] }
      },
      { key: 'input', label: '输入', type: 'variable', required: true },
      { key: 'schema', label: 'JSON Schema', type: 'json' }
    ],
    [{ name: 'params', type: 'object' }]
  )
]
