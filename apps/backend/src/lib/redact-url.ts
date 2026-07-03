// Share tokens travel in the URL path (e.g. `/v1/share-tokens/{token}/redeem`),
// so any code that logs a request URL must mask the token segment before it
// reaches log output/storage.
const SHARE_TOKEN_URL_PATTERN = /^(\/v1\/share-tokens)\/[^/?]+/

export function redactShareTokenUrl(url: string): string {
  return url.replace(SHARE_TOKEN_URL_PATTERN, '$1/[redacted]')
}
