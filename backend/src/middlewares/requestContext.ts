import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestContext(req: Request, res: Response, next: NextFunction) {
	// RequestId e Idempotency-Key ficam centralizados aqui para correlacionar logs e resposta sem estado global.
	res.locals.requestId = req.header('X-Request-Id') ?? randomUUID()
	res.locals.idempotencyKey = req.header('Idempotency-Key') ?? undefined
	res.setHeader('X-Request-Id', res.locals.requestId)

	next()
}
