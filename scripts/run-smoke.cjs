'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

process.env.ORCH_SMOKE = '1'
if (process.argv.includes('--examples')) {
  // 依次打开每个内置示例并截图到 .screenshots/smoke-example-<name>.png
  process.env.ORCH_SMOKE_EXAMPLES = '1'
}

const electron = require('electron')
const projectRoot = path.resolve(__dirname, '..')
const child = spawn(electron, ['.'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
