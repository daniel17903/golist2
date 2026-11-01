// Smoke test of the production build, run the way the Docker image runs it:
// the compiled `dist/` plus the `@golist/shared` TypeScript source, loaded by
// plain Node (type stripping) - no vitest, tsx or bundler. Those resolve
// imports more leniently (extensionless relative imports, path aliases), so
// a module that only fails under plain Node passes every other check.
// Run after `npm run build -w apps/backend` (`npm run smoke:dist -w apps/backend`).
import { readFile } from 'node:fs/promises'

const failures = []

// Every entry point of the shared package, as the backend's dist imports them.
const sharedPackage = JSON.parse(
  await readFile(new URL('../../../packages/shared/package.json', import.meta.url), 'utf8'),
)
for (const subpath of Object.keys(sharedPackage.exports)) {
  const specifier = `@golist/shared${subpath.slice(1)}`
  try {
    await import(specifier)
  } catch (error) {
    failures.push(`import ${specifier}: ${error.message}`)
  }
}

// The compiled server with every route, answering the health checks the
// deployment uses (Coolify probes /healthz).
try {
  const { buildServer } = await import('../dist/server.js')
  const app = buildServer({ listRepository: { ping: async () => {} }, logger: false })
  for (const url of ['/health', '/healthz']) {
    const response = await app.inject({ method: 'GET', url })
    if (response.statusCode !== 200) {
      failures.push(`GET ${url}: ${response.statusCode} ${response.body}`)
    }
  }
  await app.close()
} catch (error) {
  failures.push(`load dist/server.js: ${error.message}`)
}

if (failures.length > 0) {
  console.error(`[smoke:dist] FAILED\n${failures.map((failure) => `  - ${failure}`).join('\n')}`)
  process.exit(1)
}
console.log('[smoke:dist] production build loads and answers /health and /healthz')
