import { query } from './db/client.js'

type Queryable = {
  query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>
}

const listAccessQuery = `SELECT EXISTS(
   SELECT 1
     FROM shared_lists
    WHERE id = $1
      AND created_by_device_id = $2
 )
 OR EXISTS(
   SELECT 1
     FROM share_token_redemptions redemptions
     JOIN share_tokens tokens
       ON tokens.id = redemptions.token_id
    WHERE redemptions.device_id = $2
      AND tokens.list_id = $1
      AND tokens.revoked_at IS NULL
      AND (tokens.expires_at IS NULL OR tokens.expires_at > NOW())
 ) AS has_access`

export async function hasListAccessWithClient(client: Queryable, listId: string, deviceId: string): Promise<boolean> {
  const accessResult = await client.query<{ has_access: boolean }>(listAccessQuery, [listId, deviceId])
  return Boolean(accessResult.rows[0]?.has_access)
}

export async function hasListAccess(listId: string, deviceId: string): Promise<boolean> {
  const accessResult = await query<{ has_access: boolean }>(listAccessQuery, [listId, deviceId])
  return Boolean(accessResult.rows[0]?.has_access)
}
