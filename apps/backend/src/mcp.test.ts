import crypto from 'node:crypto'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildServer } from './server.js'
import { type ListRepository } from './repositories/list-repository.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'
import { checkResponsesAgainstSpec } from './test/openapi-spec.js'

const ownerDeviceId = '11111111-1111-4111-8111-111111111111'
const otherDeviceId = '22222222-2222-4222-8222-222222222222'

const hasDatabase = Boolean(process.env.PGHOST || process.env.DATABASE_URL)

let baseUrl = ''
const clients: Client[] = []

const jsonObjectSchema = z.record(z.string(), z.unknown())

const api = async (method: string, path: string, deviceId: string, body?: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'x-device-id': deviceId, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: jsonObjectSchema.parse(text ? JSON.parse(text) : {}) }
}

const createList = async (name: string, deviceId = ownerDeviceId, listType: 'shopping' | 'todo' = 'shopping') => {
  const listId = crypto.randomUUID()
  const response = await api('PUT', `/v1/lists/${listId}`, deviceId, { name, listType })
  expect(response.status).toBe(201)
  return listId
}

const createConnector = async (input: { includeAllLists: boolean; listIds?: string[] }, deviceId = ownerDeviceId) => {
  const response = await api('POST', '/v1/connectors', deviceId, { label: 'Claude', listIds: [], ...input })
  expect(response.status).toBe(201)
  return z.object({ key: z.string(), connector: z.object({ connectorId: z.uuid() }) }).parse(response.body)
}

const connect = async (key: string) => {
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/v1/mcp/${key}`)))
  clients.push(client)
  return client
}

const resultSchema = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  isError: z.boolean().optional(),
})

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = resultSchema.parse(await client.callTool({ name, arguments: args }))
  if (result.isError) {
    throw new Error(result.content[0]?.text)
  }
  return jsonObjectSchema.parse(JSON.parse(result.content[0].text))
}

const callError = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = resultSchema.parse(await client.callTool({ name, arguments: args }))
  expect(result.isError).toBe(true)
  return result.content[0].text
}

const listNames = async (client: Client) =>
  z
    .object({ lists: z.array(z.object({ name: z.string() })) })
    .parse(await call(client, 'list_lists'))
    .lists.map((list) => list.name)

// The connector access rules live in SQL for Postgres, so run everything
// against the production repository too when a database is configured.
type RepositoryCase = [name: string, make: () => Promise<ListRepository>]
const repositories: RepositoryCase[] = [['in-memory', async () => new InMemoryListRepository()]]
if (hasDatabase) {
  repositories.push(['postgres', async () => (await import('./repositories/postgres-list-repository.js')).postgresListRepository])
}

afterAll(async () => {
  if (hasDatabase) {
    await (await import('./db/client.js')).pool.end()
  }
})

describe.each(repositories)('MCP connectors (%s repository)', (_, makeRepository) => {
  let app: ReturnType<typeof buildServer>
  let specCheck: { violations: string[] }

  beforeAll(async () => {
    app = buildServer({ listRepository: await makeRepository(), logger: false, appUrl: 'https://app.example' })
    specCheck = checkResponsesAgainstSpec(app)
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address()
    if (!address || typeof address === 'string') {
      throw new Error('server did not bind a port')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()))
  })

  afterAll(async () => {
    await app.close()
    // Every response must match openapi.yaml, except the MCP protocol bodies
    // themselves (JSON-RPC / SSE, not described there).
    expect(specCheck.violations.filter((violation) => !/^\w+ \/v1\/mcp\/\{key\} → (?!404)/.test(violation))).toEqual([])
  })

  describe('MCP server', () => {
    it('answers 404 for an unknown key', async () => {
      const response = await fetch(`${baseUrl}/v1/mcp/not-a-key`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      expect(response.status).toBe(404)
    })

    it('lists the tools', async () => {
      const { key } = await createConnector({ includeAllLists: true })
      const client = await connect(key)
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        'add_items',
        'complete_items',
        'create_list',
        'delete_items',
        'get_list',
        'join_list',
        'list_lists',
        'rename_list',
        'share_list',
        'update_item',
      ])
    })

    it('serves 2025-era clients over the stateless fallback', async () => {
      const { key } = await createConnector({ includeAllLists: true })
      const response = await fetch(`${baseUrl}/v1/mcp/${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legacy', version: '1.0.0' } },
        }),
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('"protocolVersion":"2025-06-18"')

      const listId = await createList('Legacy groceries')
      const toolCall = await fetch(`${baseUrl}/v1/mcp/${key}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_list', arguments: { listId } } }),
      })
      expect(toolCall.status).toBe(200)
      expect(await toolCall.text()).toContain('Legacy groceries')
    })

    it('reaches all of the owner\'s lists, including lists created later, and no others', async () => {
      const first = await createList('Groceries')
      await createList('Not mine', otherDeviceId)
      const { key } = await createConnector({ includeAllLists: true })
      const client = await connect(key)
      await createList('Hardware store')

      expect(await listNames(client)).toEqual(expect.arrayContaining(['Groceries', 'Hardware store']))
      expect(await listNames(client)).not.toContain('Not mine')
      expect(await call(client, 'get_list', { listId: first })).toMatchObject({ name: 'Groceries', items: [] })
    })

    it('reaches only the picked lists, and follows changes to the selection', async () => {
      const owner = crypto.randomUUID()
      const picked = await createList('Picked', owner)
      const notPicked = await createList('Not picked', owner)
      const { key, connector } = await createConnector({ includeAllLists: false, listIds: [picked] }, owner)
      const client = await connect(key)

      expect(await listNames(client)).toEqual(['Picked'])
      expect(await callError(client, 'get_list', { listId: notPicked })).toContain('No list with this id')

      await api('PUT', `/v1/connectors/${connector.connectorId}`, owner, {
        label: 'Claude',
        includeAllLists: false,
        listIds: [notPicked],
      })
      expect(await listNames(client)).toEqual(['Not picked'])
    })

    it('loses access when the owner loses access', async () => {
      const owner = crypto.randomUUID()
      const listId = await createList('Shared with me', otherDeviceId)
      const token = await api('POST', `/v1/lists/${listId}/share-tokens`, otherDeviceId)
      await api('POST', `/v1/share-tokens/${String(token.body.shareToken)}/redeem`, owner)
      const { key } = await createConnector({ includeAllLists: true }, owner)
      const client = await connect(key)
      expect(await listNames(client)).toEqual(['Shared with me'])

      await api('DELETE', `/v1/lists/${listId}`, otherDeviceId)
      expect(await listNames(client)).toEqual([])
    })

    it('adds, updates and checks off shopping items as its own device, and pushes them to open apps', async () => {
      const owner = crypto.randomUUID()
      const listId = await createList('Weekly shop', owner)
      await api('PUT', `/v1/lists/${listId}/items/${crypto.randomUUID()}`, owner, {
        name: 'Milch',
        deleted: false,
        updatedAt: new Date().toISOString(),
      })
      const { key } = await createConnector({ includeAllLists: true }, owner)
      const client = await connect(key)

      const socket = new WebSocket(`${baseUrl.replace('http', 'ws')}/v1/ws`)
      const patches: Array<{ type: string; items?: Array<{ name: string; deleted: boolean }> }> = []
      socket.addEventListener('message', (event) => patches.push(JSON.parse(String(event.data))))
      await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
      socket.send(JSON.stringify({ type: 'hello', deviceId: owner }))
      socket.send(JSON.stringify({ type: 'subscribe_list', listId }))
      await expect.poll(() => patches.some((message) => message.type === 'subscribed')).toBe(true)

      expect(
        await call(client, 'add_items', {
          listId,
          items: [{ name: 'Äpfel', quantityOrUnit: '1 kg' }, { name: 'milch', quantityOrUnit: '2' }, { name: 'Brot' }],
        }),
      ).toEqual({ list: 'Weekly shop', added: ['Äpfel', 'Brot'], updated: ['Milch'], alreadyOnList: [] })

      await expect
        .poll(() => patches.flatMap((message) => (message.type === 'item_patch' ? message.items ?? [] : [])).map((item) => item.name))
        .toEqual(expect.arrayContaining(['Äpfel', 'Brot', 'Milch']))

      const list = z
        .object({ items: z.array(z.object({ itemId: z.string(), name: z.string(), quantityOrUnit: z.string().optional(), category: z.string() })) })
        .parse(await call(client, 'get_list', { listId }))
      const apples = list.items.find((item) => item.name === 'Äpfel')!
      // German category mapping, detected from the existing item ("Milch").
      expect(apples).toMatchObject({ quantityOrUnit: '1 kg', category: 'fruitsVegetables' })

      await call(client, 'complete_items', { listId, itemIds: [apples.itemId] })
      await expect
        .poll(() => patches.some((message) => message.items?.some((item) => item.name === 'Äpfel' && item.deleted)))
        .toBe(true)
      expect((await api('GET', `/v1/lists/${listId}`, owner)).body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Äpfel', deleted: true })]),
      )
      socket.close()
    })

    it('completes a recurring todo and creates its next occurrence like the app', async () => {
      const owner = crypto.randomUUID()
      const listId = await createList('Chores', owner, 'todo')
      const { key } = await createConnector({ includeAllLists: true }, owner)
      const client = await connect(key)

      await call(client, 'add_items', {
        listId,
        items: [
          {
            name: 'Water the plants',
            dueDate: '2026-03-02',
            assignedTo: 'Sam',
            points: 3,
            recurrence: { every: 1, unit: 'week', anchor: 'from_due_date' },
          },
        ],
      })
      const todoSchema = z.object({
        items: z.array(z.object({ itemId: z.string(), name: z.string(), dueDate: z.string().optional(), completedAt: z.string().optional() })),
      })
      const [todo] = todoSchema.parse(await call(client, 'get_list', { listId })).items
      expect(todo).toMatchObject({ dueDate: '2026-03-02' })

      expect(await call(client, 'complete_items', { listId, itemIds: [todo.itemId] })).toEqual({
        list: 'Chores',
        completed: ['Water the plants'],
        nextOccurrences: [{ name: 'Water the plants', dueDate: '2026-03-09' }],
      })
      const open = todoSchema.parse(await call(client, 'get_list', { listId })).items
      expect(open).toEqual([expect.objectContaining({ name: 'Water the plants', dueDate: '2026-03-09' })])
      expect(open[0].itemId).not.toBe(todo.itemId)
      const all = todoSchema.parse(await call(client, 'get_list', { listId, includeCompleted: true })).items
      expect(all).toHaveLength(2)

      // Stored as Berlin midnight, like the app.
      const stored = await api('GET', `/v1/lists/${listId}/items/${open[0].itemId}`, owner)
      expect(stored.body).toMatchObject({ dueDate: '2026-03-08T23:00:00.000Z', assignedTo: 'Sam', points: 3 })
    })

    it('creates, renames and shares lists; a created list belongs to the connector', async () => {
      const owner = crypto.randomUUID()
      const { key } = await createConnector({ includeAllLists: false }, owner)
      const client = await connect(key)

      const created = z
        .object({ listId: z.uuid(), shareUrl: z.string() })
        .parse(await call(client, 'create_list', { name: 'Party', listType: 'todo' }))
      expect(created.shareUrl).toMatch(/^https:\/\/app\.example\/\?shareToken=[0-9a-f-]{36}$/)
      expect(await listNames(client)).toEqual(['Party'])

      await call(client, 'rename_list', { listId: created.listId, name: 'Garden party' })
      expect(await listNames(client)).toEqual(['Garden party'])

      // The owner gets the list by opening the share link.
      const shareToken = new URL(created.shareUrl).searchParams.get('shareToken')!
      expect((await api('POST', `/v1/share-tokens/${shareToken}/redeem`, owner)).status).toBe(200)
      expect((await api('GET', `/v1/lists/${created.listId}`, owner)).body).toMatchObject({ name: 'Garden party', listType: 'todo' })
    })

    it('a list it shared stops being reachable when the owner narrows the selection', async () => {
      const owner = crypto.randomUUID()
      const kept = await createList('Kept', owner)
      const shared = await createList('Shared by the assistant', owner)
      const { key, connector } = await createConnector({ includeAllLists: true }, owner)
      const client = await connect(key)

      await call(client, 'share_list', { listId: shared })
      await api('PUT', `/v1/connectors/${connector.connectorId}`, owner, { label: 'Claude', includeAllLists: false, listIds: [kept] })

      expect(await listNames(client)).toEqual(['Kept'])
      expect(await callError(client, 'get_list', { listId: shared })).toContain('No list with this id')
    })

    it('adds a name repeated in one call once, with the last quantity', async () => {
      const owner = crypto.randomUUID()
      const listId = await createList('Repeats', owner)
      const { key } = await createConnector({ includeAllLists: true }, owner)
      const client = await connect(key)

      expect(
        await call(client, 'add_items', { listId, items: [{ name: 'Eggs', quantityOrUnit: '6' }, { name: 'eggs', quantityOrUnit: '12' }] }),
      ).toMatchObject({ added: ['Eggs'], updated: [], alreadyOnList: [] })
      const { items } = z
        .object({ items: z.array(z.object({ name: z.string(), quantityOrUnit: z.string().optional() })) })
        .parse(await call(client, 'get_list', { listId }))
      expect(items).toEqual([expect.objectContaining({ name: 'Eggs', quantityOrUnit: '12' })])
    })

    it('can be called from a browser page on another origin', async () => {
      const { key } = await createConnector({ includeAllLists: true })
      const url = `${baseUrl}/v1/mcp/${key}`
      const preflight = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://inspector.example',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type, mcp-protocol-version',
        },
      })
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('access-control-allow-origin')).toBe('https://inspector.example')
      expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('mcp-protocol-version')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          origin: 'https://inspector.example',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('https://inspector.example')
    })

    it('joins a list from a share link', async () => {
      const listId = await createList('From a friend', otherDeviceId)
      const token = await api('POST', `/v1/lists/${listId}/share-tokens`, otherDeviceId)
      const { key } = await createConnector({ includeAllLists: false }, crypto.randomUUID())
      const client = await connect(key)

      expect(await callError(client, 'join_list', { shareLink: 'https://go-list.app/?shareToken=nope' })).toContain('not valid')
      await call(client, 'join_list', { shareLink: `https://go-list.app/?shareToken=${String(token.body.shareToken)}` })
      expect(await listNames(client)).toEqual(['From a friend'])
    })
  })

  describe('connector management API', () => {
    it('creates, lists, updates and deletes the device\'s connectors', async () => {
      const owner = crypto.randomUUID()
      const listId = await createList('Mine', owner)
      const { key, connector } = await createConnector({ includeAllLists: false, listIds: [listId, listId] }, owner)
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/)

      const listed = await api('GET', '/v1/connectors', owner)
      expect(listed.body).toEqual({
        connectors: [
          { connectorId: connector.connectorId, label: 'Claude', includeAllLists: false, listIds: [listId], createdAt: expect.any(String) },
        ],
      })
      expect((await api('GET', '/v1/connectors', otherDeviceId)).body).toEqual({ connectors: [] })

      // Another device can neither see nor change the connector.
      const path = `/v1/connectors/${connector.connectorId}`
      expect((await api('PUT', path, otherDeviceId, { label: 'X', includeAllLists: true })).status).toBe(404)
      expect((await api('DELETE', path, otherDeviceId)).status).toBe(404)
      expect((await api('POST', `${path}/key`, otherDeviceId)).status).toBe(404)

      const updated = await api('PUT', path, owner, { label: 'ChatGPT', includeAllLists: true, listIds: [listId] })
      expect(updated.body).toMatchObject({ label: 'ChatGPT', includeAllLists: true, listIds: [] })

      await connect(key)
      expect((await api('GET', '/v1/connectors', owner)).body).toMatchObject({
        connectors: [{ lastUsedAt: expect.any(String) }],
      })

      expect((await api('DELETE', path, owner)).status).toBe(204)
      expect((await api('GET', '/v1/connectors', owner)).body).toEqual({ connectors: [] })
      expect((await fetch(`${baseUrl}/v1/mcp/${key}`, { method: 'POST' })).status).toBe(404)
    })

    it('refuses lists the device cannot access', async () => {
      const foreign = await createList('Foreign', otherDeviceId)
      const response = await api('POST', '/v1/connectors', crypto.randomUUID(), {
        label: 'Claude',
        includeAllLists: false,
        listIds: [foreign],
      })
      expect(response.status).toBe(403)
    })

    it('regenerating the key retires the old URL', async () => {
      const owner = crypto.randomUUID()
      const { key, connector } = await createConnector({ includeAllLists: true }, owner)
      const rotated = await api('POST', `/v1/connectors/${connector.connectorId}/key`, owner)
      const newKey = z.object({ key: z.string() }).parse(rotated.body).key
      expect(newKey).not.toBe(key)

      expect((await fetch(`${baseUrl}/v1/mcp/${key}`, { method: 'POST' })).status).toBe(404)
      await connect(newKey)
    })
  })
})
