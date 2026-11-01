// Secrets that travel in the URL path — share tokens
// (`/v1/share-tokens/{token}/redeem`) and connector keys (`/v1/mcp/{key}`) —
// must be masked by any code that logs a request URL before the URL reaches
// log output/storage.
const SECRET_URL_PATTERN = /^(\/v1\/(?:share-tokens|mcp))\/[^/?]+/

export function redactUrlSecrets(url: string): string {
  return url.replace(SECRET_URL_PATTERN, '$1/[redacted]')
}
