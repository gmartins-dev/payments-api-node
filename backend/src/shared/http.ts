import type { Express } from 'express'

import { createPaymentsRouter } from '../modules/payments/payments.routes.js'
import { PaymentsController } from '../modules/payments/payments.controller.js'
import { NotFoundError } from './http-errors.js'

interface RouteDependencies {
  paymentsController?: PaymentsController
}

export function registerRoutes(app: Express, dependencies: RouteDependencies = {}) {
  /**
   * @openapi
   * /health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Health check
   *     description: Returns a simple operational status for the API.
   *     responses:
   *       '200':
   *         description: The API is running.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   *             example:
   *               status: ok
   */
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok'
    })
  })

  app.use('/payments', createPaymentsRouter(dependencies.paymentsController))
  app.use((_req, _res, next) => {
    next(new NotFoundError())
  })
}
