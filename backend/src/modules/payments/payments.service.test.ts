import { describe, expect, it, vi } from 'vitest'

import { ConflictError } from '../../shared/http-errors.js'
import { PaymentsService } from './payments.service.js'
import type { CreatePaymentInput, PaymentRow } from './payment.types.js'

const input: CreatePaymentInput = {
  amount: 100,
  customerId: 'customer-1'
}

describe('PaymentsService', () => {
  it('returns persisted success when the payment already exists', async () => {
    const existing = makePaymentRow({
      status: 'SUCCESS',
      responseStatusCode: 200,
      responseBody: {
        paymentId: 'payment-1',
        status: 'SUCCESS',
        amount: 100,
        customerId: 'customer-1'
      }
    })

    const repository = {
      insertPendingPayment: vi.fn().mockResolvedValue(null),
      findByIdempotencyKey: vi.fn().mockResolvedValue(existing)
    }

    const service = new PaymentsService(repository as never, {} as never)
    const response = await service.createPayment(input, 'idem-1')

    expect(response).toEqual({
      statusCode: 200,
      body: {
        paymentId: 'payment-1',
        status: 'SUCCESS',
        amount: 100,
        customerId: 'customer-1'
      }
    })
  })

  it('returns 202 when the payment remains pending during the polling window', async () => {
    const pending = makePaymentRow()

    const repository = {
      insertPendingPayment: vi.fn().mockResolvedValue(null),
      findByIdempotencyKey: vi.fn().mockResolvedValue(pending)
    }

    const service = new PaymentsService(repository as never, {} as never, {
      pollIntervalMs: 0,
      pollTimeoutMs: 0
    })
    const response = await service.createPayment(input, 'idem-2')

    expect(response).toEqual({
      statusCode: 202,
      body: {
        paymentId: pending.id,
        status: 'PENDING'
      }
    })
  })

  it('rejects reuse of the same Idempotency-Key with a different payload', async () => {
    const repository = {
      insertPendingPayment: vi.fn().mockResolvedValue(null),
      findByIdempotencyKey: vi.fn().mockResolvedValue(
        makePaymentRow({
          amount: 100,
          customerId: 'customer-a'
        })
      )
    }

    const service = new PaymentsService(repository as never, {} as never)

    await expect(
      service.createPayment(
        {
          amount: 200,
          customerId: 'customer-b'
        },
        'idem-3'
      )
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('persists and returns a failed response when processing throws', async () => {
    const pending = makePaymentRow()
    const repository = {
      insertPendingPayment: vi.fn().mockResolvedValue(pending),
      markFailed: vi.fn().mockResolvedValue(
        makePaymentRow({
          id: pending.id,
          status: 'FAILED',
          responseStatusCode: 200,
          responseBody: {
            paymentId: pending.id,
            status: 'FAILED',
            reason: 'PROCESSOR_TEMPORARY_ERROR'
          },
          errorCode: 'PROCESSOR_TEMPORARY_ERROR'
        })
      )
    }
    const processor = {
      process: vi.fn().mockRejectedValue(new Error('PROCESSOR_TEMPORARY_ERROR'))
    }

    const service = new PaymentsService(repository as never, processor as never)
    const response = await service.createPayment(input, 'idem-4')

    expect(repository.markFailed).toHaveBeenCalledOnce()
    expect(response).toEqual({
      statusCode: 200,
      body: {
        paymentId: pending.id,
        status: 'FAILED',
        reason: 'PROCESSOR_TEMPORARY_ERROR'
      }
    })
  })
})

function makePaymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'payment-1',
    idempotencyKey: 'idem-1',
    amount: 100,
    customerId: 'customer-1',
    status: 'PENDING',
    responseStatusCode: null,
    responseBody: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}
