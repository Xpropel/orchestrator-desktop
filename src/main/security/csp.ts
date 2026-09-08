export function contentSecurityPolicy(devRenderer: boolean): string {
  const connectSrc = devRenderer ? "'self' ws://localhost:*" : "'self'"
  const scriptSrc = devRenderer ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'"
  ].join('; ')
}

/** `<meta http-equiv>` 不支持 frame-ancestors，写进去 Chrome 会打 error。 */
export function contentSecurityPolicyMeta(devRenderer: boolean): string {
  return contentSecurityPolicy(devRenderer)
    .split('; ')
    .filter((directive) => !directive.startsWith('frame-ancestors'))
    .join('; ')
}
