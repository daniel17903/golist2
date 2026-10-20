import { type RouteOptions } from 'fastify'
import { describe, expect, it } from 'vitest'

import { buildServer } from './server.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'
import { registeredOperations, responseViolations, specOperations } from './test/openapi-spec.js'

// apps/api-spec/openapi.yaml must describe exactly the routes buildServer
// registers. Response bodies are checked against the spec's schemas by the
// contract tests (server.contract.test.ts). When this fails after a route
// change, update openapi.yaml and check apps/openclaw/golist_cli.py.
describe('openapi.yaml', () => {
  it('documents exactly the routes the server registers', async () => {
    const routes: RouteOptions[] = []
    const app = buildServer({
      listRepository: new InMemoryListRepository(),
      logger: false,
      onRoute: (route) => routes.push(route),
    })
    await app.ready()
    await app.close()

    expect(registeredOperations(routes).sort()).toEqual(specOperations().sort())
  })

  it('flags responses that do not match the spec', () => {
    expect(responseViolations('GET', '/health', 200, '{"status":"ok"}')).toEqual([])
    expect(responseViolations('GET', '/health', 200, '{"status":"fine"}')).toEqual([
      expect.stringContaining('body does not match openapi.yaml'),
    ])
    expect(responseViolations('GET', '/health', 418, '')).toEqual([
      expect.stringContaining('status code is not documented'),
    ])
    expect(responseViolations('PATCH', '/health', 200, '')).toEqual([
      expect.stringContaining('operation is not documented'),
    ])
    expect(responseViolations('DELETE', '/v1/lists/{listId}', 204, '{"unexpected":true}')).toEqual([
      expect.stringContaining('documents no body'),
    ])
    // Shared error responses are resolved through #/components/responses.
    expect(responseViolations('GET', '/v1/lists/{listId}', 403, '{"message":"Forbidden"}')).toEqual([])
    expect(responseViolations('GET', '/v1/lists/{listId}', 403, '{}')).toEqual([
      expect.stringContaining('body does not match openapi.yaml'),
    ])
  })
})
