import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

const currentDir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(currentDir, '../src/migrations')

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('DATABASE_URL is required to run migrations')
}

const migrationFiles = [
	resolve(migrationsDir, '001_create_payments.sql'),
	resolve(migrationsDir, '002_add_payments_updated_at_trigger.sql'),
]

const pool = new Pool({
	connectionString,
})

try {
	for (const migrationFile of migrationFiles) {
		const sql = readFileSync(migrationFile, 'utf8')
		await pool.query(sql)
	}

	console.log('Migrations applied successfully')
} finally {
	await pool.end()
}
