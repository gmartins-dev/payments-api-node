import type { NextFunction, Request, Response } from 'express'

import { logger } from '../config/logger.js'

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error(
    {
      err: error,
      requestId: res.locals.requestId,
      idempotencyKey: res.locals.idempotencyKey
    },
    'Unhandled request error'
  )

  res.status(500).json({
    message: 'Internal server error',
    requestId: res.locals.requestId
  })
}
