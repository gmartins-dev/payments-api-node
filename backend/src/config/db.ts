import { Pool, type QueryResultRow } from 'pg'

import { env } from './env.js'

export interface DatabaseClient {
	query<ResultRow extends QueryResultRow = QueryResultRow>(
		sql: string,
		params?: unknown[],
	): Promise<{ rows: ResultRow[] }>
	release(): void
}

export interface DatabasePool {
	query<ResultRow extends QueryResultRow = QueryResultRow>(
		sql: string,
		params?: unknown[],
	): Promise<{ rows: ResultRow[] }>
	connect(): Promise<DatabaseClient>
	end(): Promise<void>
}

const defaultDb = new Pool({
	connectionString: env.DATABASE_URL,
	max: 10,
})

let currentDb: DatabasePool = defaultDb

export function getDb(): DatabasePool {
	return currentDb
}

export function setDb(database: DatabasePool) {
	currentDb = database
}

export async function resetDb() {
	currentDb = defaultDb
}
