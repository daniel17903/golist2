import crypto from 'node:crypto'

/**
 * The secret in a connector URL (`/v1/mcp/{key}`): 256 random bits,
 * base64url. Only its SHA-256 hash is stored, so the key is shown once when
 * it is created (or regenerated).
 */
export const generateConnectorKey = (): string => crypto.randomBytes(32).toString('base64url')

export const hashConnectorKey = (key: string): string => crypto.createHash('sha256').update(key).digest('hex')
