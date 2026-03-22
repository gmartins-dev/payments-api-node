import type { Express } from 'express'

import { paymentsRouter } from '../modules/payments/payments.routes.js'

export function registerRoutes(app: Express) {
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok'
    })
  })

  app.use('/payments', paymentsRouter)
}
