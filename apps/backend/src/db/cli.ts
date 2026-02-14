import { pool } from './client.js'
import { runMigrations } from './migrate.js'
import { runSeed } from './seed.js'

async function main() {
  const command = process.argv[2]

  if (command === 'migrate') {
    const applied = await runMigrations()
    console.log(`Applied ${applied} migration(s).`)
  } else if (command === 'seed') {
    await runSeed()
    console.log('Seed complete.')
  } else {
    throw new Error(`Unknown db command: ${command ?? '<none>'}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
