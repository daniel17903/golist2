import { createHash, randomUUID } from 'node:crypto'

import type { PoolClient } from 'pg'

import { withTransaction } from './client.js'

function createTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function seedList(client: PoolClient): Promise<void> {
  const listId = randomUUID()
  const ownerDeviceId = randomUUID()
  const redeemedByDeviceId = randomUUID()
  const token = `seed-${randomUUID()}`

  await client.query(
    `
      INSERT INTO shared_lists(id, name, created_by_device_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [listId, 'Weekly Groceries', ownerDeviceId]
  )

  await client.query(
    `
      INSERT INTO list_items(id, list_id, text, quantity, note, position, created_by_device_id)
      VALUES
        ($1, $2, 'Milk', '1', NULL, 0, $3),
        ($4, $2, 'Eggs', '12', NULL, 1, $3),
        ($5, $2, 'Bread', '1', 'Whole wheat', 2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [randomUUID(), listId, ownerDeviceId, randomUUID(), randomUUID()]
  )

  await client.query(
    `
      INSERT INTO share_tokens(
        id,
        list_id,
        token_hash,
        created_by_device_id,
        redeemed_by_device_id,
        redeemed_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [randomUUID(), listId, createTokenHash(token), ownerDeviceId, redeemedByDeviceId]
  )

  console.log(`Seeded list ${listId} with owner device ${ownerDeviceId}`)
}

export async function runSeed(): Promise<void> {
  await withTransaction(async (client) => {
    await seedList(client)
  })
}
