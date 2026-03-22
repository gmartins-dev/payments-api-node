import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool, type PoolClient, type QueryResultRow } from 'pg'

import { resetDb, setDb } from '../config/db.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(currentDir, '../migrations')

interface QueryResult<Row> {
  rows: Row[]
}

class ScopedPgPoolAdapter {
  constructor(
    private readonly pool: Pool,
    private readonly schema: string
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    const client = await this.pool.connect()

    try {
      await setSearchPath(client, this.schema)
      const result = await client.query<Row>(sql, params)

      return {
        rows: result.rows
      }
    } finally {
      client.release()
    }
  }

  async connect() {
    const client = await this.pool.connect()
    await setSearchPath(client, this.schema)

    return {
      query: async <Row extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) => {
        const result = await client.query<Row>(sql, params)

        return {
          rows: result.rows
        }
      },
      release: () => {
        client.release()
      }
    }
  }

  async end() {
    await this.pool.end()
  }
}

export async function setupTestDatabase() {
  const connectionString = process.env.TEST_DATABASE_URL

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required to run integration tests against a real PostgreSQL instance')
  }

  const schema = `test_${randomUUID().replace(/-/g, '')}`
  const pool = new Pool({
    connectionString
  })

  await pool.query(`create schema ${quoteIdentifier(schema)}`)

  const scopedPool = new ScopedPgPoolAdapter(pool, schema)

  const migrationFiles = [
    resolve(migrationsDir, '001_create_payments.sql'),
    resolve(migrationsDir, '002_add_payments_updated_at_trigger.sql')
  ]

  for (const migrationFile of migrationFiles) {
    const sql = readFileSync(migrationFile, 'utf8')
    await scopedPool.query(sql)
  }

  setDb(scopedPool)

  return {
    pool: scopedPool,
    schema,
    async close() {
      await resetDb()
      await pool.query(`drop schema if exists ${quoteIdentifier(schema)} cascade`)
      await pool.end()
    }
  }
}

async function setSearchPath(client: PoolClient, schema: string) {
  await client.query(`set search_path to ${quoteIdentifier(schema)}, public`)
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}
