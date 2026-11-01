import { readFileSync } from 'node:fs'

import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { type FastifyInstance, type RouteOptions } from 'fastify'
import { parse } from 'yaml'
import { z } from 'zod'

// Test helpers that check the backend against apps/api-spec/openapi.yaml, so
// route or response changes cannot silently drift from the published spec
// (which API clients are written against).

const responseSchema = z.object({
  $ref: z.string().optional(),
  content: z.record(z.string(), z.object({ schema: z.unknown().optional() })).optional(),
})
const operationSchema = z.object({ responses: z.record(z.string(), responseSchema) })
// Loose: the full document (not just these keys) is handed to Ajv below.
const documentSchema = z.looseObject({
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
  components: z.looseObject({ responses: z.record(z.string(), responseSchema).optional() }),
})

const SPEC_ID = 'openapi.yaml'
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'])

export const openApiSpec = documentSchema.parse(
  parse(readFileSync(new URL('../../../api-spec/openapi.yaml', import.meta.url), 'utf8')),
)

// The whole spec is registered as one schema so that both inline response
// schemas and `#/components/schemas/...` references resolve by JSON pointer.
// OpenAPI 3.1 schemas are JSON Schema 2020-12; the spec's non-schema
// top-level keys are declared as annotation keywords to keep strict mode on.
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats.default(ajv)
ajv.addVocabulary(['openapi', 'info', 'servers', 'security', 'paths', 'components', 'x-websocket-messages'])
ajv.addSchema(openApiSpec, SPEC_ID)

const escapePointer = (segment: string) => segment.replaceAll('~', '~0').replaceAll('/', '~1')

/** `/v1/lists/:listId` → `/v1/lists/{listId}` */
export const toOpenApiPath = (fastifyUrl: string) => fastifyUrl.replace(/:(\w+)/g, '{$1}')

/** Every operation in the spec as `METHOD /path`. */
export function specOperations(): string[] {
  return Object.entries(openApiSpec.paths).flatMap(([path, pathItem]) =>
    Object.keys(pathItem)
      .filter((key) => HTTP_METHODS.has(key))
      .map((method) => `${method.toUpperCase()} ${path}`),
  )
}

/** Every route the server registers as `METHOD /path` (OpenAPI path syntax). */
export function registeredOperations(routes: RouteOptions[]): string[] {
  const operations = new Set(
    routes.flatMap((route) =>
      [route.method].flat().map((method) => `${method.toUpperCase()} ${toOpenApiPath(route.url)}`),
    ),
  )
  for (const operation of [...operations]) {
    const [method, path] = operation.split(' ')
    // Fastify adds a HEAD route for every GET route, and @fastify/cors
    // registers a catch-all preflight route; neither belongs in the spec.
    if ((method === 'HEAD' && operations.has(`GET ${path}`)) || operation === 'OPTIONS *') {
      operations.delete(operation)
    }
  }
  return [...operations]
}

/**
 * Returns the problems with one response compared to the spec: an
 * undocumented operation or status code, a JSON body that does not match the
 * documented schema, or a body where the spec documents none.
 */
export function responseViolations(
  method: string,
  path: string,
  statusCode: number,
  body: string,
): string[] {
  const label = `${method} ${path} → ${statusCode}`
  const operation = operationSchema.safeParse(openApiSpec.paths[path]?.[method.toLowerCase()])
  if (!operation.success) {
    return [`${label}: operation is not documented in openapi.yaml`]
  }

  let pointer = `/paths/${escapePointer(path)}/${method.toLowerCase()}/responses/${statusCode}`
  let response: z.infer<typeof responseSchema> | undefined = operation.data.responses[String(statusCode)]
  if (response?.$ref) {
    pointer = response.$ref.slice(1)
    response = openApiSpec.components.responses?.[response.$ref.split('/').pop()!]
  }
  if (!response) {
    return [`${label}: status code is not documented in openapi.yaml`]
  }

  if (!response.content?.['application/json']?.schema) {
    return body === '' ? [] : [`${label}: openapi.yaml documents no body, but the response has one: ${body}`]
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return [`${label}: response is not JSON: ${body}`]
  }
  const schemaRef = `${SPEC_ID}#${pointer}/content/application~1json/schema`
  // Compiles the pointer into the registered spec once, then serves it from Ajv's cache.
  const validate = ajv.getSchema(schemaRef)
  if (!validate) {
    throw new Error(`openapi.yaml has no schema at ${schemaRef}`)
  }
  if (validate(parsed)) {
    return []
  }
  return [`${label}: body does not match openapi.yaml (${ajv.errorsText(validate.errors)}): ${body}`]
}

/**
 * Checks every response the server sends against the spec. Call before the
 * first request; inspect `violations` after the test.
 */
export function checkResponsesAgainstSpec(app: FastifyInstance): { violations: string[] } {
  const violations: string[] = []
  app.addHook('onSend', async (request, reply, payload) => {
    const routeUrl = request.routeOptions.url
    if (!routeUrl) {
      violations.push(`${request.method} ${request.url}: no route matched`)
      return payload
    }
    // Same exclusions as registeredOperations: Fastify's automatic HEAD
    // routes and the CORS preflight route are not part of the spec.
    if (request.method === 'HEAD' || (request.method === 'OPTIONS' && routeUrl === '*')) {
      return payload
    }
    const body = payload === null || payload === undefined ? '' : String(payload)
    violations.push(...responseViolations(request.method, toOpenApiPath(routeUrl), reply.statusCode, body))
    return payload
  })
  return { violations }
}
