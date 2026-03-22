import type { Express } from 'express'

import { createPaymentsRouter } from '../modules/payments/payments.routes.js'
import { PaymentsController } from '../modules/payments/payments.controller.js'
import { NotFoundError } from './http-errors.js'

interface RouteDependencies {
  paymentsController?: PaymentsController
}

export function registerRoutes(app: Express, dependencies: RouteDependencies = {}) {
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
