import type { Plugin } from 'vite'
import { contentSecurityPolicyMeta } from '../src/main/security/csp'

const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/

export function cspPlugin(isDev: () => boolean): Plugin {
  return {
    name: 'orchestrator-csp',
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicyMeta(isDev())}" />`
      if (!CSP_META.test(html)) {
        return html
      }
      return html.replace(CSP_META, meta)
    }
  }
}
