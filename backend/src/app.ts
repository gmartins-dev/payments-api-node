import cors from 'cors'
import type { Request, Response } from 'express'
import express from 'express'
import { pinoHttp } from 'pino-http'

import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { registerSwagger } from './config/swagger.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { requestContext } from './middlewares/requestContext.js'
import type { PaymentsController } from './modules/payments/payments.controller.js'
import { registerRoutes } from './shared/http.js'

interface AppDependencies {
	paymentsController?: PaymentsController
}

export function createApp(dependencies: AppDependencies = {}) {
	const app = express()

	app.use(
		cors({
			origin: env.FRONTEND_URL,
		}),
	)
	app.use(express.json())
	app.use(requestContext)
	app.use(
		pinoHttp({
			logger,
			genReqId: (_req, res) => res.locals.requestId,
			customReceivedMessage: () => 'request received',
			customSuccessMessage: () => 'request completed',
			customErrorMessage: () => 'request failed',
			customProps: (_req: Request, res: Response) => ({
				requestId: res.locals.requestId,
				idempotencyKey: res.locals.idempotencyKey,
			}),
		}),
	)

	registerSwagger(app)
	registerRoutes(app, {
		paymentsController: dependencies.paymentsController,
	})
	app.use(errorHandler)

	return app
}
