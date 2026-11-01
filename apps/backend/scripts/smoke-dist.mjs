// Smoke test of the production build, run the way the Docker image runs it:
// the compiled `dist/` plus the `@golist/shared` TypeScript source, loaded by
// plain Node (type stripping) - no vitest, tsx or bundler. Those resolve
// imports more leniently (extensionless relative imports, path aliases), so
// a module that only fails under plain Node passes every other check.
// Run after `npm run build -w apps/backend` (`npm run smoke:dist -w apps/backend`).
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import net from 'node:net'

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

// The real entry point (dist/index.js), reached on the addresses the
// deployment health check uses: `wget http://localhost:3000/healthz` inside
// the container, where `localhost` resolves to ::1 first. This only checks
// that the listener accepts connections, so it requests an unknown path that
// the server answers (404) without touching the database: /healthz would wait
// for the database connection timeout here. A refused connection fails.
const freePort = await new Promise((resolve) => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
})
const ipv6Available = await new Promise((resolve) => {
  const probe = net.createServer()
  probe.once('error', () => resolve(false))
  probe.listen({ host: '::1', port: 0 }, () => probe.close(() => resolve(true)))
})
const backend = spawn(process.execPath, [new URL('../dist/index.js', import.meta.url).pathname], {
  env: { ...process.env, HOST: '0.0.0.0', PORT: String(freePort), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let backendOutput = ''
backend.stdout.on('data', (chunk) => (backendOutput += chunk))
backend.stderr.on('data', (chunk) => (backendOutput += chunk))
try {
  const hosts = ipv6Available ? ['127.0.0.1', '[::1]'] : ['127.0.0.1']
  for (const host of hosts) {
    let status = null
    for (let attempt = 0; attempt < 50 && status === null; attempt += 1) {
      try {
        status = (await fetch(`http://${host}:${freePort}/smoke-dist-listener-check`, { signal: AbortSignal.timeout(2000) })).status
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
    if (status === null) {
      failures.push(`dist/index.js: no HTTP answer on ${host}:${freePort}\n${backendOutput.slice(-2000)}`)
    }
  }
  if (!ipv6Available) {
    console.log('[smoke:dist] no IPv6 on this machine; checked the IPv4 listener only')
  }
} finally {
  backend.kill()
}

if (failures.length > 0) {
  console.error(`[smoke:dist] FAILED\n${failures.map((failure) => `  - ${failure}`).join('\n')}`)
  process.exit(1)
}
console.log('[smoke:dist] production build loads, answers /health and /healthz, and dist/index.js accepts connections')
