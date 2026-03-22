import type { Request, Response } from 'express'

import { PaymentsService } from './payments.service.js'
import type { CreatePaymentBody } from './payments.schemas.js'

export class PaymentsController {
  constructor(private readonly paymentsService = new PaymentsService()) {}

  async create(req: Request<unknown, unknown, CreatePaymentBody>, res: Response) {
    const response = await this.paymentsService.createPayment(req.body, res.locals.idempotencyKey)

    res.status(response.statusCode).json(response.body)
  }
}
