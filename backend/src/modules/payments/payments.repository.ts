import { getDb } from '../../config/db.js'
import type { DatabaseClient } from '../../config/db.js'
import { NotFoundError } from '../../shared/http-errors.js'
import type { JsonValue, PaymentRow, PaymentStatus, InsertPendingPaymentInput } from './payment.types.js'

interface PaymentRecordRow {
  id: string
  idempotency_key: string
  amount: string
  customer_id: string
  status: PaymentStatus
  response_status_code: number | null
  response_body: JsonValue | null
  error_code: string | null
  created_at: string
  updated_at: string
}

export class PaymentsRepository {
  async isReady() {
    const db = getDb()
    await db.query('select 1')

    return true
  }

  async insertPendingPayment(input: InsertPendingPaymentInput): Promise<PaymentRow | null> {
    const db = getDb()
    const query = `
      insert into payments (
        idempotency_key,
        amount,
        customer_id,
        status
      )
      values ($1, $2, $3, 'PENDING')
      on conflict (idempotency_key) do nothing
      returning
        id,
        idempotency_key,
        amount,
        customer_id,
        status,
        response_status_code,
        response_body,
        error_code,
        created_at,
        updated_at
    `

    const result = await db.query<PaymentRecordRow>(query, [input.idempotencyKey, input.amount, input.customerId])
    const row = result.rows[0]

    return row ? mapPaymentRow(row) : null
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PaymentRow | null> {
    const db = getDb()
    const query = `
      select
        id,
        idempotency_key,
        amount,
        customer_id,
        status,
        response_status_code,
        response_body,
        error_code,
        created_at,
        updated_at
      from payments
      where idempotency_key = $1
      limit 1
    `

    const result = await db.query<PaymentRecordRow>(query, [idempotencyKey])
    const row = result.rows[0]

    return row ? mapPaymentRow(row) : null
  }

  async markSuccess(id: string, responseStatusCode: number, responseBody: JsonValue): Promise<PaymentRow> {
    return this.updateFinalState({
      id,
      status: 'SUCCESS',
      responseStatusCode,
      responseBody,
      errorCode: null
    })
  }

  async markFailed(id: string, responseStatusCode: number, responseBody: JsonValue, errorCode: string): Promise<PaymentRow> {
    return this.updateFinalState({
      id,
      status: 'FAILED',
      responseStatusCode,
      responseBody,
      errorCode
    })
  }

  private async updateFinalState(input: {
    id: string
    status: Extract<PaymentStatus, 'SUCCESS' | 'FAILED'>
    responseStatusCode: number
    responseBody: JsonValue
    errorCode: string | null
  }): Promise<PaymentRow> {
    const db = getDb()
    const client = await db.connect()

    try {
      await client.query('begin')

      const result = await client.query<PaymentRecordRow>(
        `
          update payments
          set
            status = $2,
            response_status_code = $3,
            response_body = $4::jsonb,
            error_code = $5,
            updated_at = now()
          where id = $1
          returning
            id,
            idempotency_key,
            amount,
            customer_id,
            status,
            response_status_code,
            response_body,
            error_code,
            created_at,
            updated_at
        `,
        [input.id, input.status, input.responseStatusCode, JSON.stringify(input.responseBody), input.errorCode]
      )

      const row = result.rows[0]
      if (!row) {
        throw new NotFoundError(`Payment with id "${input.id}" was not found`)
      }

      await client.query('commit')

      return mapPaymentRow(row)
    } catch (error) {
      await rollbackQuietly(client)
      throw error
    } finally {
      client.release()
    }
  }
}

function mapPaymentRow(row: PaymentRecordRow): PaymentRow {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    amount: Number(row.amount),
    customerId: row.customer_id,
    status: row.status,
    responseStatusCode: row.response_status_code,
    responseBody: row.response_body,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function rollbackQuietly(client: DatabaseClient) {
  try {
    await client.query('rollback')
  } catch {
    // Ignore rollback errors and rethrow the original failure path.
  }
}
