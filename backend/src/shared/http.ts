import type { Express } from 'express'

import { paymentsRouter } from '../modules/payments/payments.routes.js'
import { NotFoundError } from './http-errors.js'

export function registerRoutes(app: Express) {
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok'
    })
  })

  app.use('/payments', paymentsRouter)
  app.use((_req, _res, next) => {
    next(new NotFoundError())
  })
}
