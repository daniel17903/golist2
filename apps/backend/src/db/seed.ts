import { randomUUID } from 'node:crypto'

import type { PoolClient } from 'pg'

import { withTransaction } from './client.js'

async function seedList(client: PoolClient): Promise<void> {
  const listId = randomUUID()
  const ownerDeviceId = randomUUID()
  const tokenId = randomUUID()

  await client.query(
    `
      INSERT INTO shared_lists(id, name, created_by_device_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [listId, 'Weekly Groceries', ownerDeviceId],
  )

  await client.query(
    `
      INSERT INTO list_items(id, list_id, name, quantity_or_unit, category, created_by_device_id)
      VALUES
        ($1, $2, 'Milk', '1', 'dairy', $3),
        ($4, $2, 'Eggs', '12', 'dairy', $3),
        ($5, $2, 'Bread', '1', 'bakery', $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [randomUUID(), listId, ownerDeviceId, randomUUID(), randomUUID()],
  )

  await client.query(
    `
      INSERT INTO share_tokens(
        id,
        list_id,
        created_by_device_id
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [tokenId, listId, ownerDeviceId],
  )

  console.log(`Seeded list ${listId} with share token ${tokenId}`)
}

export async function runSeed(): Promise<void> {
  await withTransaction(async (client) => {
    await seedList(client)
  })
}
