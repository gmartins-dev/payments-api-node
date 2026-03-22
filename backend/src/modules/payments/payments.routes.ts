import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'

import { PaymentsController } from './payments.controller.js'
import { createPaymentBodySchema, idempotencyKeyHeaderSchema } from './payments.schemas.js'
import { ValidationError } from '../../shared/http-errors.js'

export function createPaymentsRouter(paymentsController = new PaymentsController()) {
  const paymentsRouter = Router()

  paymentsRouter.post('/', createPaymentHandler(paymentsController))

  return paymentsRouter
}

export function createPaymentHandler(paymentsController: PaymentsController) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bodyResult = createPaymentBodySchema.safeParse(req.body)
      if (!bodyResult.success) {
        throw new ValidationError('Invalid payment request body', bodyResult.error.flatten())
      }

      const headerResult = idempotencyKeyHeaderSchema.safeParse(req.headers)
      if (!headerResult.success) {
        throw new ValidationError('Idempotency-Key header is required', headerResult.error.flatten())
      }

      req.body = bodyResult.data
      res.locals.idempotencyKey = headerResult.data['idempotency-key']

      await paymentsController.create(req as Request<unknown, unknown, typeof bodyResult.data>, res)
    } catch (error) {
      next(error)
    }
  }
}

export const paymentsRouter = createPaymentsRouter()
