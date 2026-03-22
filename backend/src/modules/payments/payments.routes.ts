import { Router } from 'express'

import { PaymentsController } from './payments.controller.js'
import { createPaymentBodySchema, idempotencyKeyHeaderSchema } from './payments.schemas.js'
import { ValidationError } from '../../shared/http-errors.js'

export const paymentsRouter = Router()
const paymentsController = new PaymentsController()

paymentsRouter.post('/', async (req, res, next) => {
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

    await paymentsController.create(req, res)
  } catch (error) {
    next(error)
  }
})
