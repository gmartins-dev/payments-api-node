import type { Request, Response } from 'express'
import type { CreatePaymentBody } from './payments.schemas.js'
import { PaymentsService } from './payments.service.js'

export class PaymentsController {
	constructor(private readonly paymentsService = new PaymentsService()) {}

	async create(req: Request<unknown, unknown, CreatePaymentBody>, res: Response) {
		// O controller só repassa o payload validado e a chave já normalizada no middleware/rota.
		const response = await this.paymentsService.createPayment(req.body, res.locals.idempotencyKey)

		res.status(response.statusCode).json(response.body)
	}
}
