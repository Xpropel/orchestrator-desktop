type ApiPlatformHost = {
  window?: { api?: { platform?: NodeJS.Platform } }
}

function rendererPlatform(): NodeJS.Platform | undefined {
  return (globalThis as ApiPlatformHost).window?.api?.platform
}

/** 主进程有 Node `process`；沙箱渲染进程走 preload 的 `window.api.platform`。 */
export function runtimePlatform(): NodeJS.Platform {
  const fromRenderer = rendererPlatform()
  if (fromRenderer) {
    return fromRenderer
  }
  if (typeof process !== 'undefined' && typeof process.platform === 'string') {
    return process.platform
  }
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) return 'darwin'
    if (ua.includes('linux')) return 'linux'
  }
  return 'win32'
}

export function isMacPlatform(platform: NodeJS.Platform = runtimePlatform()): boolean {
  return platform === 'darwin'
}

/** 路径白名单：Windows 与默认 APFS 都大小写不敏感。 */
export function foldsPathCase(platform: NodeJS.Platform = runtimePlatform()): boolean {
  return platform === 'win32' || platform === 'darwin'
}
