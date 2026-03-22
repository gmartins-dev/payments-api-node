import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'

import { PaymentsController } from './payments.controller.js'
import { createPaymentBodySchema, idempotencyKeyHeaderSchema } from './payments.schemas.js'
import { ValidationError } from '../../shared/http-errors.js'

export function createPaymentsRouter(paymentsController = new PaymentsController()) {
  const paymentsRouter = Router()

  /**
   * @openapi
   * /payments:
   *   post:
   *     tags:
   *       - Payments
   *     summary: Create or replay an idempotent payment
   *     description: |
   *       Creates a payment for a new `Idempotency-Key` or replays the exact persisted result for retries.
   *
   *       Idempotency behavior:
   *       - the same `Idempotency-Key` returns the exact same final response body
   *       - final persisted results return HTTP `200`
   *       - a bounded in-flight state may return HTTP `202` with `PENDING`
   *       - concurrent requests with the same key never duplicate processing
   *
   *       Edge cases:
   *       - retry after success returns the same persisted `SUCCESS` payload
   *       - retry after failure returns the same persisted `FAILED` payload
   *       - a request arriving during processing may observe `PENDING`
   *     parameters:
   *       - $ref: '#/components/parameters/IdempotencyKeyHeader'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePaymentRequest'
   *     responses:
   *       '200':
   *         description: |
   *           Final persisted result. The response is either `SUCCESS` or `FAILED`, and the same `Idempotency-Key`
   *           always replays this exact final contract.
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: '#/components/schemas/PaymentSuccessResponse'
   *                 - $ref: '#/components/schemas/PaymentFailedResponse'
   *             examples:
   *               success:
   *                 $ref: '#/components/examples/PaymentSuccessExample'
   *               failed:
   *                 $ref: '#/components/examples/PaymentFailedExample'
   *       '202':
   *         description: |
   *           The payment is still `PENDING` after the bounded polling window. Clients may retry with the same
   *           `Idempotency-Key` until the final persisted response is available.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentPendingResponse'
   *             examples:
   *               pending:
   *                 $ref: '#/components/examples/PaymentPendingExample'
   *       '400':
   *         description: Invalid header or request body.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiErrorResponse'
   *       '409':
   *         description: The same `Idempotency-Key` was reused with a different payload.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiErrorResponse'
   */
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
