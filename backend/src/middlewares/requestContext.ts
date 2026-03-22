import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestContext(req: Request, res: Response, next: NextFunction) {
  res.locals.requestId = req.header('X-Request-Id') ?? randomUUID()
  res.locals.idempotencyKey = req.header('Idempotency-Key') ?? undefined

  next()
}
