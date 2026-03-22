import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../../app.js'
import { PaymentsController } from './payments.controller.js'
import { PaymentProcessorTemporaryError } from './payment-processor.js'
import { PaymentsRepository } from './payments.repository.js'
import { PaymentsService } from './payments.service.js'
import { setupTestDatabase } from '../../test/test-db.js'
import type { CreatePaymentInput, PaymentSuccessResponse } from './payment.types.js'

let cleanup: null | (() => Promise<void>) = null

afterEach(async () => {
  if (cleanup) {
    await cleanup()
    cleanup = null
  }
})

describe.sequential('POST /payments integration', () => {
  it('creates a new payment successfully', async () => {
    const { app, pool } = await createTestApp({
      processor: {
        process: vi.fn(async (input, paymentId) => ({
          paymentId,
          status: 'SUCCESS' as const,
          amount: input.amount,
          customerId: input.customerId
        }))
      }
    })

    const response = await request(app)
      .post('/payments')
      .set('Idempotency-Key', 'success-1')
      .send({ amount: 100, customerId: 'customer-1' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'SUCCESS',
      amount: 100,
      customerId: 'customer-1'
    })

    expect(await countPayments(pool)).toBe(1)
  })

  it('retries with the same Idempotency-Key return the same persisted success response', async () => {
    const processor = {
      process: vi.fn(async (input: { amount: number; customerId: string }, paymentId: string) => ({
        paymentId,
        status: 'SUCCESS' as const,
        amount: input.amount,
        customerId: input.customerId
      }))
    }
    const { app, pool } = await createTestApp({ processor })

    const first = await request(app)
      .post('/payments')
      .set('Idempotency-Key', 'retry-success')
      .send({ amount: 100, customerId: 'customer-1' })

    const second = await request(app)
      .post('/payments')
      .set('Idempotency-Key', 'retry-success')
      .send({ amount: 100, customerId: 'customer-1' })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(processor.process).toHaveBeenCalledTimes(1)

    expect(await countPayments(pool)).toBe(1)
  })

  it('retries with the same Idempotency-Key after failure return the same persisted failure response', async () => {
    const processor = {
      process: vi.fn(async (_input: unknown, paymentId: string) => {
        throw new PaymentProcessorTemporaryError(paymentId)
      })
    }
    const { app, pool } = await createTestApp({ processor })

    const first = await request(app)
      .post('/payments')
      .set('Idempotency-Key', 'retry-failure')
      .send({ amount: 100, customerId: 'customer-1' })

    const second = await request(app)
      .post('/payments')
      .set('Idempotency-Key', 'retry-failure')
      .send({ amount: 100, customerId: 'customer-1' })

    expect(first.status).toBe(200)
    expect(first.body).toEqual({
      paymentId: first.body.paymentId,
      status: 'FAILED',
      reason: 'PROCESSOR_TEMPORARY_ERROR'
    })
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(processor.process).toHaveBeenCalledTimes(1)

    expect(await countPayments(pool)).toBe(1)
  })

  it('concurrent requests with the same Idempotency-Key do not create duplicate payment rows', async () => {
    const processor = new ControlledProcessor()
    const { app, pool } = await createTestApp({ processor })

    const payload = { amount: 100, customerId: 'customer-1' }
    const requests = Array.from({ length: 5 }).map(() =>
      Promise.resolve(
        request(app).post('/payments').set('Idempotency-Key', 'concurrency-1').send(payload)
      )
    )

    // Espera o vencedor entrar no processador antes de liberar o resultado e observar as demais requests em paralelo.
    await processor.waitUntilCalledTimes(1)
    await delay(25)
    processor.resolveSuccess(payload)

    const responses = await Promise.all(requests)
    const serializedBodies = new Set(responses.map((response) => JSON.stringify(response.body)))

    expect(new Set(responses.map((response) => response.status))).toEqual(new Set([200]))
    expect(serializedBodies.size).toBe(1)
    expect(responses[0]?.body).toEqual({
      paymentId: expect.any(String),
      status: 'SUCCESS',
      amount: 100,
      customerId: 'customer-1'
    })

    expect(processor.process).toHaveBeenCalledTimes(1)

    expect(await countPayments(pool)).toBe(1)
  })

  it('a request arriving while processing is pending returns final state or 202 PENDING without duplicate processing', async () => {
    const processor = new ControlledProcessor()
    const { app, pool } = await createTestApp({
      processor,
      pollIntervalMs: 1,
      pollTimeoutMs: 50
    })

    const payload = { amount: 100, customerId: 'customer-1' }
    const firstPromise = Promise.resolve(
      request(app).post('/payments').set('Idempotency-Key', 'pending-1').send(payload)
    )

    // Garante que a segunda request chega enquanto a primeira ainda é dona exclusiva do processamento.
    await processor.waitUntilCalledTimes(1)

    const second = await request(app).post('/payments').set('Idempotency-Key', 'pending-1').send(payload)

    expect(second.status).toBe(202)
    expect(second.body).toEqual({
      paymentId: expect.any(String),
      status: 'PENDING'
    })

    processor.resolveSuccess(payload)

    const first = await firstPromise

    expect(first.status).toBe(200)
    expect(first.body).toEqual({
      paymentId: expect.any(String),
      status: 'SUCCESS',
      amount: 100,
      customerId: 'customer-1'
    })

    expect(processor.process).toHaveBeenCalledTimes(1)

    expect(await countPayments(pool)).toBe(1)
  })
})

async function createTestApp(options: {
  processor: {
    process: (input: { amount: number; customerId: string }, paymentId: string) => Promise<unknown>
  }
  pollIntervalMs?: number
  pollTimeoutMs?: number
}) {
  const database = await setupTestDatabase()
  cleanup = async () => {
    await database.close()
  }

  // Os testes de concorrência usam Postgres real porque a semântica de conflito precisa ser a do banco de verdade.
  const repository = new PaymentsRepository()
  const service = new PaymentsService(repository, options.processor as never, {
    pollIntervalMs: options.pollIntervalMs,
    pollTimeoutMs: options.pollTimeoutMs
  })
  const controller = new PaymentsController(service)
  const app = createApp({
    paymentsController: controller
  })

  return {
    app,
    pool: database.pool
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

class ControlledProcessor {
  readonly process = vi.fn(async (input: CreatePaymentInput, paymentId: string): Promise<PaymentSuccessResponse> => {
    return await new Promise<PaymentSuccessResponse>((resolve) => {
      // Essa barreira manual evita falso positivo de timing e deixa a janela de concorrência sob controle do teste.
      this.pendingResolutions.push(() =>
        resolve({
          paymentId,
          status: 'SUCCESS',
          amount: input.amount,
          customerId: input.customerId
        })
      )
    })
  })

  private readonly pendingResolutions: Array<() => void> = []

  async waitUntilCalledTimes(expectedCalls: number) {
    while (this.process.mock.calls.length < expectedCalls) {
      await delay(1)
    }
  }

  resolveSuccess(_input: CreatePaymentInput) {
    const nextResolution = this.pendingResolutions.shift()

    if (!nextResolution) {
      throw new Error('No pending processor invocation to resolve')
    }

    nextResolution()
  }
}

async function countPayments(pool: { query: (sql: string) => Promise<{ rows: Array<{ count: number }> }> }) {
  const result = await pool.query('select count(*)::int as count from payments')

  return result.rows[0]?.count ?? 0
}
