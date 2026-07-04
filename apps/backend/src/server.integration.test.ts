import crypto from 'node:crypto'

import { buildItemHash } from '@golist/shared/domain/sync'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { buildServer } from './server.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'

const testDeviceId = '11111111-1111-4111-8111-111111111111'

let baseUrl = ''
let app: ReturnType<typeof buildServer>

const openSyncSocket = async (targetBaseUrl: string = baseUrl) => {
  const socket = new WebSocket(`${targetBaseUrl.replace('http', 'ws')}/v1/ws`)
  const messages: Array<Record<string, unknown>> = []
  let notify: (() => void) | null = null

  const messageSchema = z.record(z.string(), z.unknown())

  socket.addEventListener('message', (event) => {
    messages.push(messageSchema.parse(JSON.parse(String(event.data))))
    notify?.()
  })

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('websocket connection failed')), { once: true })
  })

  const send = (message: Record<string, unknown>) => socket.send(JSON.stringify(message))

  const waitForMessage = async (
    predicate: (message: Record<string, unknown>) => boolean,
    timeoutMs = 2_000,
  ): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const found = messages.find(predicate)
      if (found) {
        return found
      }
      if (Date.now() > deadline) {
        throw new Error('timed out waiting for websocket message')
      }
      await new Promise<void>((resolve) => {
        notify = resolve
        setTimeout(resolve, 25)
      })
    }
  }

  return { socket, messages, send, waitForMessage }
}

const createShareTokenForList = async (listId: string, deviceId: string) => {
  const response = await fetch(`${baseUrl}/v1/lists/${listId}/share-tokens`, {
    method: 'POST',
    headers: { 'x-device-id': deviceId },
  })

  expect(response.status).toBe(201)

  return z
    .object({ tokenId: z.string().uuid(), listId: z.string().uuid(), shareToken: z.string().uuid() })
    .parse(await response.json())
}

describe('backend runtime integration', () => {
  beforeAll(async () => {
    app = buildServer({ listRepository: new InMemoryListRepository() })
    await app.listen({ host: '127.0.0.1', port: 0 })

    const address = app.server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address for integration test')
    }

    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves health and handles list lifecycle endpoints', async () => {
    const healthResponse = await fetch(`${baseUrl}/health`)

    expect(healthResponse.status).toBe(200)
    expect(await healthResponse.json()).toEqual({ status: 'ok' })

    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Integration Test List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    expect(createPayload.listId).toBe(listId)

    const initialToken = await createShareTokenForList(createPayload.listId, testDeviceId)

    const authHeaders = { 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${initialToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(200)

    const redeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemResponse.json())

    const listResponse = await fetch(`${baseUrl}/v1/lists/${redeemPayload.listId}`, {
      headers: authHeaders,
    })

    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual(
      expect.objectContaining({
        name: 'Integration Test List',
        items: [],
      }),
    )
  })

  it('handles CORS preflight for list creation endpoint', async () => {
    const listId = crypto.randomUUID()
    const response = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type,x-device-id',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
    expect(response.headers.get('access-control-allow-headers')).toContain('X-Device-Id')
  })

  it('creates items via PUT and enforces deterministic LWW tie-break conflicts', async () => {
    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Conflict List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    const initialToken = await createShareTokenForList(createPayload.listId, testDeviceId)

    const authHeaders = { 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${initialToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(200)

    const itemId = crypto.randomUUID()
    const createItemTimestamp = new Date().toISOString()

    const createItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Milk',
          quantityOrUnit: '1L',
          category: 'dairy',
          deleted: false,
          updatedAt: createItemTimestamp,
        }),
      },
    )

    expect(createItemResponse.status).toBe(201)

    const baselineItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`,
      {
        headers: authHeaders,
      },
    )

    expect(baselineItemResponse.status).toBe(200)

    const baselineItem = z
      .object({
        id: z.string().uuid(),
        updatedAt: z.string().datetime(),
      })
      .parse(await baselineItemResponse.json())

    const sameTimestamp = new Date(Date.parse(baselineItem.updatedAt) + 60_000).toISOString()

    const candidateA = { name: 'Yogurt', iconName: 'default', quantityOrUnit: '2', category: 'dairy', deleted: false }
    const candidateB = { name: 'Apple', iconName: 'default', quantityOrUnit: '5', category: 'produce', deleted: false }

    const [firstUpdateResponse, secondUpdateResponse] = await Promise.all(
      [candidateA, candidateB].map((candidate) =>
        fetch(`${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`, {
          method: 'PUT',
          headers: {
            ...authHeaders,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ...candidate, updatedAt: sameTimestamp }),
        }),
      ),
    )

    expect(firstUpdateResponse.status).toBe(204)
    expect(secondUpdateResponse.status).toBe(204)

    // The winner of an equal-timestamp conflict is the candidate with the
    // larger shared item hash — the same rule the web client applies.
    const hashOfCandidate = (candidate: typeof candidateA) =>
      buildItemHash({
        id: itemId,
        listId: createPayload.listId,
        ...candidate,
        updatedAt: Date.parse(sameTimestamp),
      })
    const expectedWinner = hashOfCandidate(candidateA) > hashOfCandidate(candidateB) ? candidateA : candidateB

    const itemResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`, {
      headers: authHeaders,
    })

    expect(itemResponse.status).toBe(200)
    expect(await itemResponse.json()).toEqual(
      expect.objectContaining({
        id: itemId,
        ...expectedWinner,
        updatedAt: sameTimestamp,
      }),
    )
  })

  it('applies last-write-wins to websocket list metadata patches', async () => {
    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Original Name' }),
    })

    expect(createResponse.status).toBe(201)

    const clientA = await openSyncSocket()
    const clientB = await openSyncSocket()

    try {
      for (const client of [clientA, clientB]) {
        client.send({ type: 'hello', deviceId: testDeviceId })
        await client.waitForMessage((message) => message.type === 'hello_ack')
        client.send({ type: 'subscribe_list', listId })
        await client.waitForMessage((message) => message.type === 'subscribed')
      }

      const subscribed = await clientB.waitForMessage((message) => message.type === 'subscribed')
      const listUpdatedAt = z.number().parse(subscribed.listUpdatedAt)

      const freshUpdatedAt = listUpdatedAt + 60_000
      clientB.send({ type: 'list_metadata_patch', listId, name: 'Stale Name', updatedAt: listUpdatedAt - 60_000 })
      clientB.send({ type: 'list_metadata_patch', listId, name: 'Fresh Name', updatedAt: freshUpdatedAt })

      const patch = await clientA.waitForMessage((message) => message.type === 'list_metadata_patch')

      expect(patch).toEqual({ type: 'list_metadata_patch', listId, name: 'Fresh Name', updatedAt: freshUpdatedAt })
      expect(clientA.messages.filter((message) => message.type === 'list_metadata_patch')).toHaveLength(1)

      const listResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
        headers: { 'x-device-id': testDeviceId },
      })

      expect(listResponse.status).toBe(200)
      expect(await listResponse.json()).toEqual(
        expect.objectContaining({
          name: 'Fresh Name',
          updatedAt: new Date(freshUpdatedAt).toISOString(),
        }),
      )
    } finally {
      clientA.socket.close()
      clientB.socket.close()
    }
  })

  it('deterministically resolves same-timestamp websocket list-metadata rename conflicts regardless of arrival order', async () => {
    // Simulates two offline devices independently renaming the same shared
    // list, then reconnecting near-simultaneously so both `list_metadata_patch`
    // messages carry the exact same millisecond `updatedAt`. Without a
    // deterministic tie-break, whichever patch the server happened to apply
    // last would win — letting devices diverge depending on network timing.
    // The rule (lexicographically greater name wins on a tie) must produce
    // the same final name no matter which patch arrives first.
    const runScenario = async (firstPatchName: string, secondPatchName: string) => {
      const listId = crypto.randomUUID()
      const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
        body: JSON.stringify({ name: 'Original Name' }),
      })

      expect(createResponse.status).toBe(201)

      const clientA = await openSyncSocket()
      const clientB = await openSyncSocket()

      try {
        for (const client of [clientA, clientB]) {
          client.send({ type: 'hello', deviceId: testDeviceId })
          await client.waitForMessage((message) => message.type === 'hello_ack')
          client.send({ type: 'subscribe_list', listId })
          await client.waitForMessage((message) => message.type === 'subscribed')
        }

        const subscribed = await clientB.waitForMessage((message) => message.type === 'subscribed')
        const listUpdatedAt = z.number().parse(subscribed.listUpdatedAt)
        const tiedUpdatedAt = listUpdatedAt + 60_000

        clientB.send({ type: 'list_metadata_patch', listId, name: firstPatchName, updatedAt: tiedUpdatedAt })
        clientB.send({ type: 'list_metadata_patch', listId, name: secondPatchName, updatedAt: tiedUpdatedAt })

        // "Zebra" always wins the tie, so it always ends up broadcast to the
        // observing client — either directly (it's the winning patch) or
        // because it was applied first and the later, losing patch is
        // dropped without a broadcast.
        await clientA.waitForMessage(
          (message) => message.type === 'list_metadata_patch' && message.name === 'Zebra',
        )

        const listResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
          headers: { 'x-device-id': testDeviceId },
        })

        expect(listResponse.status).toBe(200)
        return z.object({ name: z.string(), updatedAt: z.string() }).parse(await listResponse.json())
      } finally {
        clientA.socket.close()
        clientB.socket.close()
      }
    }

    // Each scenario uses its own list (and therefore its own tied `updatedAt`,
    // derived from that list's creation time) — what must hold regardless of
    // arrival order is that the lexicographically greater name always wins.
    const orderOneResult = await runScenario('Alpha', 'Zebra')
    const orderTwoResult = await runScenario('Zebra', 'Alpha')

    expect(orderOneResult.name).toBe('Zebra')
    expect(orderTwoResult.name).toBe('Zebra')
  })

  it('does not rebroadcast websocket item patches that lose conflict resolution', async () => {
    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Item Patch List' }),
    })

    expect(createResponse.status).toBe(201)

    const itemId = crypto.randomUUID()
    const baseTimestamp = Date.now()
    const createItemResponse = await fetch(`${baseUrl}/v1/lists/${listId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({
        name: 'Milk',
        iconName: 'default',
        category: 'dairy',
        deleted: false,
        updatedAt: new Date(baseTimestamp).toISOString(),
      }),
    })

    expect(createItemResponse.status).toBe(201)

    const clientA = await openSyncSocket()
    const clientB = await openSyncSocket()

    try {
      for (const client of [clientA, clientB]) {
        client.send({ type: 'hello', deviceId: testDeviceId })
        await client.waitForMessage((message) => message.type === 'hello_ack')
        client.send({ type: 'subscribe_list', listId })
        await client.waitForMessage((message) => message.type === 'subscribed')
      }

      const buildPatchItem = (name: string, updatedAt: number) => ({
        id: itemId,
        listId,
        name,
        iconName: 'default',
        category: 'dairy',
        deleted: false,
        createdAt: baseTimestamp,
        updatedAt,
      })

      const freshUpdatedAt = baseTimestamp + 60_000
      clientB.send({ type: 'item_patch', listId, items: [buildPatchItem('Stale Milk', baseTimestamp - 60_000)] })
      clientB.send({ type: 'item_patch', listId, items: [buildPatchItem('Fresh Milk', freshUpdatedAt)] })

      const patch = await clientA.waitForMessage((message) => message.type === 'item_patch')

      expect(patch).toEqual(
        expect.objectContaining({
          type: 'item_patch',
          listId,
          items: [expect.objectContaining({ id: itemId, name: 'Fresh Milk', updatedAt: freshUpdatedAt })],
        }),
      )
      expect(clientA.messages.filter((message) => message.type === 'item_patch')).toHaveLength(1)

      const itemResponse = await fetch(`${baseUrl}/v1/lists/${listId}/items/${itemId}`, {
        headers: { 'x-device-id': testDeviceId },
      })

      expect(itemResponse.status).toBe(200)
      expect(await itemResponse.json()).toEqual(
        expect.objectContaining({
          name: 'Fresh Milk',
          updatedAt: new Date(freshUpdatedAt).toISOString(),
        }),
      )
    } finally {
      clientA.socket.close()
      clientB.socket.close()
    }
  })

  it('caches the list digest snapshot so repeated list_digest checks do not re-query the repository', async () => {
    const repository = new InMemoryListRepository()
    const scopedApp = buildServer({ listRepository: repository })
    await scopedApp.listen({ host: '127.0.0.1', port: 0 })

    const address = scopedApp.server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address for scoped test app')
    }

    const scopedBaseUrl = `http://127.0.0.1:${address.port}`

    try {
      const listId = crypto.randomUUID()
      const createResponse = await fetch(`${scopedBaseUrl}/v1/lists/${listId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
        body: JSON.stringify({ name: 'Digest Cache List' }),
      })

      expect(createResponse.status).toBe(201)

      const listItemsSpy = vi.spyOn(repository, 'listItems')

      const client = await openSyncSocket(scopedBaseUrl)

      try {
        client.send({ type: 'hello', deviceId: testDeviceId })
        await client.waitForMessage((message) => message.type === 'hello_ack')

        client.send({ type: 'subscribe_list', listId })
        const subscribed = await client.waitForMessage((message) => message.type === 'subscribed')

        // subscribe_list has to read the item set once to build the initial
        // digest/summaries snapshot — this seeds the cache.
        expect(listItemsSpy).toHaveBeenCalledTimes(1)

        const serverDigest = z.string().parse(subscribed.serverListDigest)

        client.send({ type: 'list_digest', listId, digest: serverDigest })
        await new Promise((resolve) => setTimeout(resolve, 100))

        // A digest ping for an unchanged list must be served from the cached
        // snapshot rather than re-fetching and re-hashing every item.
        expect(listItemsSpy).toHaveBeenCalledTimes(1)
        // Digests match, so no unsolicited hash_diff should follow (only the
        // one hash_diff subscribe_list already sent).
        expect(client.messages.filter((message) => message.type === 'hash_diff')).toHaveLength(1)

        // A second, independent list_digest ping must also hit the cache.
        client.send({ type: 'list_digest', listId, digest: serverDigest })
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(listItemsSpy).toHaveBeenCalledTimes(1)
      } finally {
        client.socket.close()
      }
    } finally {
      await scopedApp.close()
    }
  })

  it('forbids putting an existing list without a valid access token', async () => {
    const listId = crypto.randomUUID()

    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Owned List' }),
    })

    expect(createResponse.status).toBe(201)

    const intruderDeviceId = '22222222-2222-4222-8222-222222222222'
    const forbiddenUpdateResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-device-id': intruderDeviceId,
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    })

    expect(forbiddenUpdateResponse.status).toBe(403)
  })

  it('completes share-token creation and redemption across multiple devices', async () => {
    const ownerDeviceId = '33333333-3333-4333-8333-333333333333'
    const guestDeviceId = '44444444-4444-4444-8444-444444444444'
    const secondGuestDeviceId = '55555555-5555-4555-8555-555555555555'
    const listId = crypto.randomUUID()

    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': ownerDeviceId },
      body: JSON.stringify({ name: 'Token Flow List' }),
    })

    expect(createResponse.status).toBe(201)

    const createdList = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    const primaryToken = await createShareTokenForList(createdList.listId, ownerDeviceId)

    const unredeemedGuestHeaders = { 'x-device-id': guestDeviceId }

    const unredeemedGuestListResponse = await fetch(`${baseUrl}/v1/lists/${createdList.listId}`, {
      headers: unredeemedGuestHeaders,
    })

    expect(unredeemedGuestListResponse.status).toBe(403)

    const redeemPrimaryTokenResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${primaryToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: unredeemedGuestHeaders,
      },
    )

    expect(redeemPrimaryTokenResponse.status).toBe(200)

    const primaryRedeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemPrimaryTokenResponse.json())

    const redeemedGuestListResponse = await fetch(`${baseUrl}/v1/lists/${primaryRedeemPayload.listId}`, {
      headers: unredeemedGuestHeaders,
    })

    expect(redeemedGuestListResponse.status).toBe(200)

    const secondaryToken = await createShareTokenForList(createdList.listId, guestDeviceId)

    expect(secondaryToken.listId).toBe(listId)
    expect(secondaryToken.shareToken).toBe(secondaryToken.tokenId)

    const secondGuestHeaders = { 'x-device-id': secondGuestDeviceId }

    const secondUnredeemedListResponse = await fetch(`${baseUrl}/v1/lists/${secondaryToken.listId}`, {
      headers: secondGuestHeaders,
    })

    expect(secondUnredeemedListResponse.status).toBe(403)

    const redeemSecondaryTokenResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${secondaryToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: secondGuestHeaders,
      },
    )

    expect(redeemSecondaryTokenResponse.status).toBe(200)

    const secondaryRedeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemSecondaryTokenResponse.json())

    const secondRedeemedListResponse = await fetch(`${baseUrl}/v1/lists/${secondaryRedeemPayload.listId}`, {
      headers: secondGuestHeaders,
    })

    expect(secondRedeemedListResponse.status).toBe(200)
  })
})
