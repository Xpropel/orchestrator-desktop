import tseslint from 'typescript-eslint'

/** 相对路径向上爬到某一层目录（覆盖任意深度，天然挡住 ../state 这类绕过）。 */
function relDir(dir, message) {
  return { regex: `(\\.\\./)+${dir}(/|$)`, message }
}

const banMain = [
  { group: ['**/src/main/**'], message: 'renderer 禁止 import 主进程' },
  relDir('main', 'renderer 禁止相对路径 import 主进程')
]

const oldPaths = [
  { group: ['@/components', '@/components/*'], message: 'components/ 已拆除，使用 ui/ features/ app/' },
  { group: ['@/model', '@/model/*'], message: 'model/ 已迁到 core/' },
  { group: ['@/hooks', '@/hooks/*'], message: 'hooks/ 已拆到 features/ shared/' },
  { group: ['@/store', '@/store/*'], message: 'store/ 已改名为 state/' },
  { group: ['@/lib/*'], message: 'lib/ 已拆到 core/ features/ app/ platform/ shared/' },
  { group: ['@/components/layout/PropertyPanel', '@/components/layout/*'], message: '禁止回流到旧 layout 路径' },
  ...banMain
]

function aliasAndRel(dir, message) {
  return [
    { group: [`@/${dir}`, `@/${dir}/*`], message },
    relDir(dir, `${message}（相对路径）`)
  ]
}

function featureBlock(name, others) {
  return {
    files: [`src/renderer/src/features/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...aliasAndRel('app', `features/${name} 不能 import app`),
            ...others.flatMap((other) => [
              {
                group: [`@/features/${other}`, `@/features/${other}/*`],
                message: `features/${name} 不能 import features/${other}`
              },
              relDir(other, `features/${name} 不能相对路径 import features/${other}`)
            ]),
            ...oldPaths
          ]
        }
      ]
    }
  }
}

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', '**/*.cjs']
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  },
  {
    files: ['src/renderer/src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'core 禁止 React' },
            { name: 'react-dom', message: 'core 禁止 React' },
            { name: 'zustand', message: 'core 禁止 zustand' },
            { name: '@xyflow/react', message: 'core 禁止 @xyflow/react' },
            { name: 'lucide-react', message: 'core 禁止 lucide-react' }
          ],
          patterns: [
            ...aliasAndRel('state', 'core 禁止 state'),
            ...aliasAndRel('features', 'core 禁止 features'),
            ...aliasAndRel('app', 'core 禁止 app'),
            ...aliasAndRel('platform', 'core 禁止 platform'),
            ...aliasAndRel('ui', 'core 禁止 ui'),
            ...aliasAndRel('shared', 'core 禁止 shared'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/state/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'state 禁止 React' },
            { name: 'react-dom', message: 'state 禁止 react-dom' }
          ],
          patterns: [
            ...aliasAndRel('features', 'state 禁止 features'),
            ...aliasAndRel('app', 'state 禁止 app'),
            ...aliasAndRel('platform', 'state 禁止 platform'),
            ...aliasAndRel('ui', 'state 禁止 ui'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  featureBlock('canvas', ['palette', 'inspector', 'issues', 'files']),
  featureBlock('palette', ['canvas', 'inspector', 'issues', 'files']),
  featureBlock('inspector', ['canvas', 'palette', 'issues', 'files']),
  featureBlock('issues', ['canvas', 'palette', 'inspector', 'files']),
  featureBlock('files', ['canvas', 'palette', 'inspector', 'issues']),
  {
    files: ['src/renderer/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='useFlowStore'][property.name='setState']",
          message: 'features 禁止 useFlowStore.setState，走 dirty-slice / 公开动作'
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...aliasAndRel('features', 'platform 禁止 features'),
            ...aliasAndRel('ui', 'platform 禁止 ui'),
            ...aliasAndRel('app', 'platform 禁止 app'),
            ...aliasAndRel('state', 'platform 禁止 state'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...aliasAndRel('features', 'ui 禁止 features'),
            ...aliasAndRel('state', 'ui 禁止 state'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'shared 禁止 React' },
            { name: 'react-dom', message: 'shared 禁止 React' }
          ],
          patterns: [
            ...aliasAndRel('features', 'shared 禁止 features'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/shared 禁止 React' },
            { name: 'react-dom', message: 'src/shared 禁止 React' },
            { name: 'electron', message: 'src/shared 禁止 electron' }
          ],
          patterns: [
            ...aliasAndRel('features', 'src/shared 禁止 features'),
            ...oldPaths
          ]
        }
      ]
    }
  },
  {
    files: [
      'src/renderer/src/app/**/*.{ts,tsx}',
      'src/renderer/src/test/**/*.{ts,tsx}',
      'src/renderer/src/main.tsx',
      'src/renderer/src/env.d.ts'
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: oldPaths }]
    }
  }
)
