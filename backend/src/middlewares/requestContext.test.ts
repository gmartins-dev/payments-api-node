import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

import { requestContext } from './requestContext.js'

describe('requestContext', () => {
  it('stores requestId and idempotencyKey in response locals', () => {
    const req = {
      header: vi.fn((name: string) => {
        if (name === 'X-Request-Id') return 'req-123'
        if (name === 'Idempotency-Key') return 'idem-123'
        return undefined
      })
    } as unknown as Request

    const res = {
      locals: {},
      setHeader: vi.fn()
    } as unknown as Response

    const next = vi.fn() as NextFunction

    requestContext(req, res, next)

    expect(res.locals.requestId).toBe('req-123')
    expect(res.locals.idempotencyKey).toBe('idem-123')
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-123')
    expect(next).toHaveBeenCalledOnce()
  })

  it('generates a requestId when the header is not provided', () => {
    const req = {
      header: vi.fn((name: string) => {
        if (name === 'Idempotency-Key') return 'idem-456'
        return undefined
      })
    } as unknown as Request

    const res = {
      locals: {},
      setHeader: vi.fn()
    } as unknown as Response

    const next = vi.fn() as NextFunction

    requestContext(req, res, next)

    expect(typeof res.locals.requestId).toBe('string')
    expect(res.locals.requestId.length).toBeGreaterThan(0)
    expect(res.locals.idempotencyKey).toBe('idem-456')
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', res.locals.requestId)
    expect(next).toHaveBeenCalledOnce()
  })
})
