import { session } from 'electron'
import { contentSecurityPolicy } from './csp'
import { isDevRenderer } from '../window/smoke-env'

export function applyContentSecurityPolicy(): void {
  const policy = contentSecurityPolicy(isDevRenderer())
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write')
  })
}
