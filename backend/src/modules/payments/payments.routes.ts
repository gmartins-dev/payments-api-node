import { Router } from 'express'

export const paymentsRouter = Router()

paymentsRouter.post('/', (_req, res) => {
  res.status(501).json({
    message: 'Payments module not implemented yet'
  })
})
