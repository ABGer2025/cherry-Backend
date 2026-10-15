import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../../../shared/utils/responseHandler';

export const orderSchema = Joi.object({
  orderId: Joi.string().trim().required(),
  paymentIntentId: Joi.string().trim().required(),
});

export function validateOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { error, value } = orderSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });
  if (error) {
    ResponseHandler.badRequest(
      res,
      'Validation failed',
      error.details[0].message,
    );
    return;
  }
  req.body = value;
  next();
}
