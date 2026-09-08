import type { OperatorCategory, OperatorDefinition } from '../schema'
import { CONTROL, DATA, INTEGRATION, INTERACTION, KNOWLEDGE, LOGIC, MISC, op } from './define'

export const BUILTIN_CATEGORIES: OperatorCategory[] = [
  { key: 'control', title: '开始 / 结束', order: 10 },
  { key: 'logic', title: '逻辑控制', order: 20 },
  { key: 'llm', title: '大模型', order: 30 },
  { key: 'knowledge', title: '知识', order: 40 },
  { key: 'data', title: '数据处理', order: 50 },
  { key: 'integration', title: '集成', order: 60 },
  { key: 'interaction', title: '交互', order: 70 },
  { key: 'misc', title: '其他', order: 80 }
]

export const BUILTIN_OPERATORS: OperatorDefinition[] = [
  op(
    'start',
    'Start',
    '流程入口。outputs 由其 inputs 参数动态派生',
    'Play',
    CONTROL,
    'control',
    'start',
    [
      { key: 'inputs', label: '入参', type: 'inputs', default: [], hint: '声明后可被下游以 {{start.key}} 或节点名引用' },
      {
        key: 'mode',
        label: '模式',
        type: 'select',
        default: 'conversational',
        options: [
          { label: '对话', value: 'conversational' },
          { label: '任务', value: 'task' }
        ]
      }
    ],
    [],
    { constraints: { allowRoot: true, outputsFromParam: 'inputs' } }
  ),
  op(
    'end',
    'End',
    '流程终点，无输出端口',
    'CircleStop',
    CONTROL,
    'control',
    'end',
    [{ key: 'output', label: '输出', type: 'template', hint: '可引用上游变量作为流程结果' }],
    []
  ),
  op(
    'if',
    'If',
    '按布尔表达式分支，未命中走 Else',
    'Filter',
    LOGIC,
    'logic',
    'branch',
    [{ key: 'cases', label: '条件', type: 'cases', required: true }],
    [],
    { constraints: { hasElseBranch: true } }
  ),
  op(
    'switch',
    'Switch',
    '按多条件分支到不同下游，未命中走 Else',
    'GitBranch',
    LOGIC,
    'logic',
    'branch',
    [{ key: 'cases', label: '条件', type: 'cases', required: true }],
    [],
    { constraints: { hasElseBranch: true } }
  ),
  op(
    'foreach',
    'For Each',
    '对列表每一项循环。体内可用 item / index；结束后对外暴露 results',
    'Repeat',
    LOGIC,
    'logic',
    'container',
    [
      {
        key: 'items',
        label: '列表',
        type: 'variable',
        required: true,
        extra: { accept: ['array', 'any'] }
      },
      { key: 'maxIterations', label: '最大次数', type: 'number', default: 100, min: 1 }
    ],
    [{ name: 'results', type: 'array' }],
    {
      scopeVariables: [
        { name: 'item', type: 'any' },
        { name: 'index', type: 'number' }
      ]
    }
  ),
  op(
    'while',
    'While',
    '按条件循环。体内可用 index',
    'RefreshCw',
    LOGIC,
    'logic',
    'container',
    [
      { key: 'condition', label: '循环条件', type: 'expression', required: true },
      { key: 'maxIterations', label: '最大次数', type: 'number', default: 100, min: 1 }
    ],
    [{ name: 'count', type: 'number' }],
    { scopeVariables: [{ name: 'index', type: 'number' }] }
  ),
  op(
    'break',
    'Break',
    '跳出当前循环，只能放在容器内部',
    'Ban',
    LOGIC,
    'logic',
    'break',
    [{ key: 'when', label: '条件', type: 'expression', hint: '可选，为空则立即跳出' }],
    [],
    { constraints: { onlyInsideContainer: true } }
  ),
  op(
    'wait',
    'Wait',
    '延时等待',
    'Timer',
    LOGIC,
    'logic',
    'task',
    [
      { key: 'seconds', label: '延时（秒）', type: 'number', default: 1, min: 0 },
      { key: 'until', label: '等到时刻', type: 'string', hint: 'ISO 时间，填写时优先于秒数' }
    ],
    [{ name: 'waited', type: 'number' }]
  ),
  op(
    'merge',
    'Merge',
    '等待多条入边后合并',
    'GitMerge',
    LOGIC,
    'logic',
    'task',
    [
      {
        key: 'strategy',
        label: '合并策略',
        type: 'select',
        default: 'waitAll',
        options: [
          { label: '等待全部', value: 'waitAll' },
          { label: '取最先到达', value: 'first' }
        ]
      }
    ],
    [{ name: 'value', type: 'any' }]
  ),
  op(
    'loop-start',
    'Loop Start',
    '容器内部起点，随容器自动创建，不可单独删除/复制',
    'Play',
    LOGIC,
    'logic',
    'loopStart',
    [],
    [],
    { constraints: { deletable: false, hidden: true } }
  ),
  op(
    'retrieval',
    'Retrieval',
    '从知识库检索相关片段',
    'Search',
    KNOWLEDGE,
    'knowledge',
    'task',
    [
      { key: 'query', label: '查询', type: 'template', required: true },
      { key: 'datasets', label: '知识库', type: 'stringList', default: [] },
      { key: 'topK', label: 'Top K', type: 'number', default: 5, min: 1 },
      {
        key: 'similarityThreshold',
        label: '相似度阈值',
        type: 'slider',
        default: 0.2,
        min: 0,
        max: 1,
        step: 0.01
      }
    ],
    [
      { name: 'chunks', type: 'array' },
      { name: 'text', type: 'string' }
    ]
  ),
  op(
    'document-parser',
    'Document Parser',
    '解析文档为文本',
    'FileSearch',
    KNOWLEDGE,
    'knowledge',
    'task',
    [
      {
        key: 'file',
        label: '文件',
        type: 'variable',
        required: true,
        extra: { accept: ['file', 'string'] }
      },
      {
        key: 'format',
        label: '格式',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动', value: 'auto' },
          { label: 'PDF', value: 'pdf' },
          { label: 'DOCX', value: 'docx' },
          { label: 'HTML', value: 'html' },
          { label: 'Markdown', value: 'markdown' }
        ]
      }
    ],
    [
      { name: 'text', type: 'string' },
      { name: 'pages', type: 'array' }
    ]
  ),
  op(
    'dataset',
    'Dataset',
    '数据集：声明一批数据的类型与结构，可作为编排的初始数据源',
    'Database',
    DATA,
    'data',
    'task',
    [
      {
        key: 'data_type',
        label: '数据类型',
        type: 'select',
        default: 'table',
        hint: '数据集的形态，如表格、文本、文档或向量',
        options: [
          { label: '表格/记录集', value: 'table' },
          { label: '文本集合', value: 'text' },
          { label: '任意 JSON', value: 'json' },
          { label: '文档集合', value: 'documents' },
          { label: '向量集合', value: 'embeddings' },
          { label: '文件列表', value: 'files' }
        ]
      },
      {
        key: 'source',
        label: '来源',
        type: 'select',
        default: 'inline',
        hint: '数据从哪里读入',
        options: [
          { label: '内联数据', value: 'inline' },
          { label: '本地文件', value: 'file' },
          { label: '远程地址', value: 'url' },
          { label: '上游变量', value: 'upstream' }
        ]
      },
      {
        key: 'fields',
        label: '字段定义',
        type: 'inputs',
        default: [],
        hint: '声明后可被下游以 {{节点名.字段}} 引用'
      },
      {
        key: 'inline_data',
        label: '内联数据',
        type: 'json',
        hint: '直接写入 JSON 对象；数组请包在对象里，如 { "rows": [] }',
        showWhen: { key: 'source', equals: 'inline' }
      },
      {
        key: 'path',
        label: '文件路径',
        type: 'string',
        hint: '本地文件路径',
        showWhen: { key: 'source', equals: 'file' }
      },
      {
        key: 'url',
        label: '地址',
        type: 'string',
        hint: '远程数据地址',
        showWhen: { key: 'source', equals: 'url' }
      },
      {
        key: 'upstream_ref',
        label: '上游引用',
        type: 'template',
        hint: '引用上游变量，如 {{Node.data}}',
        showWhen: { key: 'source', equals: 'upstream' }
      },
      {
        key: 'format',
        label: '格式',
        type: 'select',
        default: 'json',
        hint: '文件或远程数据的编码格式；内联来源可忽略',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'JSONL', value: 'jsonl' },
          { label: 'CSV', value: 'csv' },
          { label: 'Parquet', value: 'parquet' },
          { label: 'TXT', value: 'txt' }
        ]
      },
      { key: 'description', label: '说明', type: 'text', hint: '数据集的用途与内容说明' },
      {
        key: 'sample_limit',
        label: '预览条数',
        type: 'number',
        default: 20,
        min: 0,
        hint: '预览时最多展示的条数'
      }
    ],
    [
      { name: 'data', type: 'array', description: '整个数据集（记录数组）' },
      { name: 'count', type: 'number', description: '记录条数' },
      { name: 'schema', type: 'object', description: '字段结构（由字段定义生成）' }
    ],
    { constraints: { allowRoot: true, outputsFromParam: 'fields' } }
  ),
  op(
    'code',
    'Code',
    '执行自定义脚本',
    'Code',
    DATA,
    'data',
    'task',
    [
      {
        key: 'language',
        label: '语言',
        type: 'select',
        default: 'python',
        options: [
          { label: 'Python', value: 'python' },
          { label: 'JavaScript', value: 'javascript' }
        ]
      },
      { key: 'code', label: '代码', type: 'code', required: true, extra: { language: 'python' } },
      { key: 'arguments', label: '参数', type: 'keyValue', default: {} }
    ],
    [
      { name: 'result', type: 'any' },
      { name: 'stdout', type: 'string' }
    ]
  ),
  op(
    'set-variable',
    'Set Variable',
    '批量赋值变量',
    'Variable',
    DATA,
    'data',
    'task',
    [{ key: 'assignments', label: '赋值', type: 'assignments', required: true, default: [] }],
    [{ name: 'variables', type: 'object' }]
  ),
  op(
    'variable-aggregator',
    'Variable Aggregator',
    '聚合多个上游变量',
    'Combine',
    DATA,
    'data',
    'task',
    [
      { key: 'sources', label: '来源', type: 'stringList', default: [], hint: '上游变量引用，如 {{Node.var}}' },
      {
        key: 'mode',
        label: '模式',
        type: 'select',
        default: 'append',
        options: [
          { label: '追加为数组', value: 'append' },
          { label: '合并对象', value: 'merge' }
        ]
      }
    ],
    [{ name: 'value', type: 'any' }]
  ),
  op(
    'transform',
    'Transform',
    '用 JSONPath 或模板变换数据',
    'Shuffle',
    DATA,
    'data',
    'task',
    [
      { key: 'input', label: '输入', type: 'variable', required: true },
      {
        key: 'mode',
        label: '模式',
        type: 'select',
        default: 'jsonpath',
        options: [
          { label: 'JSONPath', value: 'jsonpath' },
          { label: '模板', value: 'template' }
        ]
      },
      {
        key: 'expression',
        label: 'JSONPath',
        type: 'expression',
        showWhen: { key: 'mode', equals: 'jsonpath' }
      },
      {
        key: 'template',
        label: '模板',
        type: 'template',
        showWhen: { key: 'mode', equals: 'template' }
      }
    ],
    [{ name: 'value', type: 'any' }]
  ),
  op(
    'list-operation',
    'List Operation',
    '对列表做 map / filter / slice / unique / flatten',
    'List',
    DATA,
    'data',
    'task',
    [
      {
        key: 'items',
        label: '列表',
        type: 'variable',
        required: true,
        extra: { accept: ['array', 'any'] }
      },
      {
        key: 'operation',
        label: '操作',
        type: 'select',
        default: 'map',
        options: [
          { label: '映射', value: 'map' },
          { label: '过滤', value: 'filter' },
          { label: '切片', value: 'slice' },
          { label: '去重', value: 'unique' },
          { label: '展平', value: 'flatten' }
        ]
      },
      { key: 'expression', label: '表达式', type: 'expression' },
      {
        key: 'start',
        label: '起始',
        type: 'number',
        default: 0,
        showWhen: { key: 'operation', equals: 'slice' }
      },
      {
        key: 'count',
        label: '数量',
        type: 'number',
        showWhen: { key: 'operation', equals: 'slice' }
      }
    ],
    [{ name: 'items', type: 'array' }]
  ),
  op(
    'text-operation',
    'Text Operation',
    '文本裁剪、拆分、替换、大小写',
    'Type',
    DATA,
    'data',
    'task',
    [
      { key: 'text', label: '文本', type: 'template', required: true },
      {
        key: 'operation',
        label: '操作',
        type: 'select',
        default: 'trim',
        options: [
          { label: 'Trim', value: 'trim' },
          { label: 'Split', value: 'split' },
          { label: 'Replace', value: 'replace' },
          { label: 'Join', value: 'join' },
          { label: 'Lowercase', value: 'lowercase' },
          { label: 'Uppercase', value: 'uppercase' }
        ]
      },
      {
        key: 'search',
        label: '查找',
        type: 'string',
        showWhen: { key: 'operation', equals: 'replace' }
      },
      {
        key: 'replacement',
        label: '替换为',
        type: 'string',
        showWhen: { key: 'operation', equals: 'replace' }
      },
      {
        key: 'separator',
        label: '分隔符',
        type: 'string',
        showWhen: { key: 'operation', equals: 'split' }
      }
    ],
    [
      { name: 'text', type: 'string' },
      { name: 'items', type: 'array' }
    ]
  ),
  op(
    'http',
    'HTTP Request',
    '发起 HTTP 请求',
    'Globe',
    INTEGRATION,
    'integration',
    'task',
    [
      {
        key: 'method',
        label: '方法',
        type: 'select',
        default: 'GET',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ label: value, value }))
      },
      { key: 'url', label: 'URL', type: 'string', required: true },
      { key: 'headers', label: 'Headers', type: 'keyValue', default: {} },
      { key: 'query', label: 'Query', type: 'keyValue', default: {} },
      { key: 'body', label: 'Body', type: 'template' },
      { key: 'timeout', label: '超时（秒）', type: 'number', default: 30, min: 0 }
    ],
    [
      { name: 'status', type: 'number' },
      { name: 'body', type: 'any' },
      { name: 'headers', type: 'object' }
    ]
  ),
  op(
    'webhook',
    'Webhook',
    '等待外部 webhook 回调',
    'Webhook',
    INTEGRATION,
    'integration',
    'task',
    [
      { key: 'path', label: '路径', type: 'string', required: true },
      {
        key: 'method',
        label: '方法',
        type: 'select',
        default: 'POST',
        options: ['GET', 'POST', 'PUT'].map((value) => ({ label: value, value }))
      },
      { key: 'secret', label: '密钥引用', type: 'string' }
    ],
    [
      { name: 'headers', type: 'object' },
      { name: 'body', type: 'any' },
      { name: 'query', type: 'object' }
    ]
  ),
  op(
    'sql',
    'SQL',
    '执行 SQL 查询',
    'Database',
    INTEGRATION,
    'integration',
    'task',
    [
      {
        key: 'driver',
        label: '驱动',
        type: 'select',
        default: 'postgres',
        options: [
          { label: 'PostgreSQL', value: 'postgres' },
          { label: 'MySQL', value: 'mysql' },
          { label: 'SQLite', value: 'sqlite' }
        ]
      },
      { key: 'dsn', label: 'DSN', type: 'string', required: true, hint: '可用环境变量，勿写明文密码' },
      { key: 'query', label: 'SQL', type: 'template', required: true },
      { key: 'args', label: '参数', type: 'json' }
    ],
    [
      { name: 'rows', type: 'array' },
      { name: 'rowCount', type: 'number' }
    ]
  ),
  op(
    'file-read',
    'File Read',
    '读取本地或上游文件',
    'FileInput',
    INTEGRATION,
    'integration',
    'task',
    [
      {
        key: 'path',
        label: '路径',
        type: 'variable',
        required: true,
        extra: { accept: ['file', 'string'] }
      },
      {
        key: 'encoding',
        label: '编码',
        type: 'select',
        default: 'utf-8',
        options: [
          { label: 'UTF-8', value: 'utf-8' },
          { label: 'Binary', value: 'binary' }
        ]
      }
    ],
    [
      { name: 'text', type: 'string' },
      { name: 'bytes', type: 'any' }
    ]
  ),
  op(
    'file-write',
    'File Write',
    '写入文件',
    'FileOutput',
    INTEGRATION,
    'integration',
    'task',
    [
      { key: 'path', label: '路径', type: 'string', required: true },
      { key: 'content', label: '内容', type: 'template', required: true },
      {
        key: 'encoding',
        label: '编码',
        type: 'select',
        default: 'utf-8',
        options: [
          { label: 'UTF-8', value: 'utf-8' },
          { label: 'Binary', value: 'binary' }
        ]
      }
    ],
    [{ name: 'path', type: 'string' }]
  ),
  op(
    'email',
    'Email',
    '发送邮件',
    'Mail',
    INTEGRATION,
    'integration',
    'task',
    [
      { key: 'to', label: '收件人', type: 'string', required: true },
      { key: 'subject', label: '主题', type: 'string', required: true },
      { key: 'body', label: '正文', type: 'template', required: true },
      { key: 'cc', label: '抄送', type: 'string' }
    ],
    [{ name: 'messageId', type: 'string' }]
  ),
  op(
    'message',
    'Message',
    '向会话输出一条消息',
    'MessageSquare',
    INTERACTION,
    'interaction',
    'task',
    [{ key: 'content', label: '内容', type: 'template', required: true }],
    [{ name: 'text', type: 'string' }]
  ),
  op(
    'human-input',
    'Human Input',
    '等待人工填写',
    'TextCursorInput',
    INTERACTION,
    'interaction',
    'task',
    [
      { key: 'prompt', label: '提示', type: 'template', required: true },
      { key: 'fields', label: '字段', type: 'inputs', default: [] },
      { key: 'timeout', label: '超时（秒）', type: 'number', default: 0, hint: '0 为不限' }
    ],
    [{ name: 'values', type: 'object' }]
  ),
  op(
    'approval',
    'Approval',
    '人工审批，出口固定 approved / rejected',
    'BadgeCheck',
    INTERACTION,
    'interaction',
    'branch',
    [
      { key: 'prompt', label: '说明', type: 'template', required: true },
      { key: 'timeout', label: '超时（秒）', type: 'number', default: 0 }
    ],
    [
      { name: 'decision', type: 'string' },
      { name: 'comment', type: 'string' }
    ]
  ),
  op(
    'subflow',
    'Subflow',
    '调用另一 JSON 流程',
    'Workflow',
    MISC,
    'misc',
    'task',
    [
      { key: 'path', label: '流程文件', type: 'string', required: true, hint: '另一个 .flow.json 路径' },
      { key: 'inputs', label: '入参', type: 'keyValue', default: {} }
    ],
    [{ name: 'output', type: 'any' }]
  ),
  op(
    'custom',
    'Custom',
    '自定义扩展算子，整表 JSON 参数',
    'Puzzle',
    MISC,
    'misc',
    'task',
    [{ key: 'params', label: '参数 (JSON)', type: 'json', extra: { replaceForm: true } }],
    [{ name: 'result', type: 'any' }]
  ),
  op(
    'note',
    'Note',
    '画布备注，不参与执行',
    'StickyNote',
    MISC,
    'misc',
    'note',
    [{ key: 'text', label: '内容', type: 'text', default: '' }],
    []
  )
]
