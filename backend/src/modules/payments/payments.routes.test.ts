import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/http-errors.js'
import { createPaymentHandler } from './payments.routes.js'

describe('createPaymentHandler', () => {
  it('passes validated input to the controller and propagates the idempotency key', async () => {
    const controller = {
      create: vi.fn().mockResolvedValue(undefined)
    }
    const req = {
      body: {
        amount: 100,
        customerId: 'customer-1'
      },
      headers: {
        'idempotency-key': 'idem-1'
      }
    } as unknown as Request
    const res = {
      locals: {}
    } as Response
    const next = vi.fn()

    await createPaymentHandler(controller as never)(req, res, next)

    expect(controller.create).toHaveBeenCalledOnce()
    expect(res.locals.idempotencyKey).toBe('idem-1')
    expect(next).not.toHaveBeenCalled()
  })

  it('forwards validation errors when the idempotency key header is missing', async () => {
    const controller = {
      create: vi.fn()
    }
    const req = {
      body: {
        amount: 100,
        customerId: 'customer-1'
      },
      headers: {}
    } as unknown as Request
    const res = {
      locals: {}
    } as Response
    const next = vi.fn()

    await createPaymentHandler(controller as never)(req, res, next)

    expect(controller.create).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError)
  })
})
