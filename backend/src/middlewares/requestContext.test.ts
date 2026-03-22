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
      locals: {}
    } as Response

    const next = vi.fn() as NextFunction

    requestContext(req, res, next)

    expect(res.locals.requestId).toBe('req-123')
    expect(res.locals.idempotencyKey).toBe('idem-123')
    expect(next).toHaveBeenCalledOnce()
  })
})
