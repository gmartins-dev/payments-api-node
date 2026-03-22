import cors from 'cors'
import express from 'express'
import { pinoHttp } from 'pino-http'
import type { Request, Response } from 'express'

import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { requestContext } from './middlewares/requestContext.js'
import { registerRoutes } from './shared/http.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.FRONTEND_URL
    })
  )
  app.use(express.json())
  app.use(requestContext)
  app.use(
    pinoHttp({
      logger,
      customProps: (_req: Request, res: Response) => ({
        requestId: res.locals.requestId,
        idempotencyKey: res.locals.idempotencyKey
      })
    })
  )

  registerRoutes(app)
  app.use(errorHandler)

  return app
}
