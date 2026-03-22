import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { logger } from '../config/logger.js'
import { AppError } from '../shared/http-errors.js'

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const normalizedError = normalizeError(error)

  logger.error(
    {
      err: normalizedError,
      code: normalizedError.code,
      requestId: res.locals.requestId,
      idempotencyKey: res.locals.idempotencyKey
    },
    'Unhandled request error'
  )

  res.status(normalizedError.statusCode).json({
    code: normalizedError.code,
    message: normalizedError.message,
    details: normalizedError.details,
    requestId: res.locals.requestId
  })
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', error.flatten())
  }

  return new AppError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
}
