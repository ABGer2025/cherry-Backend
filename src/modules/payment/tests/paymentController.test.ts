const mockCreateOrderId = jest.fn();
const mockCreatePaymentIntentForUserByUid = jest.fn();

jest.mock('../../order/repositories/OrderRepository', () => ({
  OrderRepository: jest.fn().mockImplementation(() => ({
    createOrderId: mockCreateOrderId,
  })),
}));

jest.mock('../services/PaymentService', () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    createPaymentIntentForUserByUid: mockCreatePaymentIntentForUserByUid,
  })),
}));

jest.mock('../../../shared/config/stripeConfig', () => ({
  createWebhook: jest.fn(),
}));

import { Request, Response } from 'express';
import { createPaymentIntent } from '../controllers/paymentController';

describe('paymentController.createPaymentIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateOrderId.mockReturnValue('server-generated-order-id');
    mockCreatePaymentIntentForUserByUid.mockResolvedValue({
      orderId: 'server-generated-order-id',
    });
  });

  it('passes a server-generated order ID and authenticated buyer to the payment service', async () => {
    const body = {
      orderId: 'client-supplied-order-id',
      productId: 'product-1',
    };
    const req = {
      user: { uid: 'authenticated-buyer' },
      body,
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    await createPaymentIntent(req, res);

    expect(mockCreatePaymentIntentForUserByUid).toHaveBeenCalledWith(
      'authenticated-buyer',
      'server-generated-order-id',
      body,
    );
    expect(mockCreatePaymentIntentForUserByUid).not.toHaveBeenCalledWith(
      expect.anything(),
      'client-supplied-order-id',
      expect.anything(),
    );
  });
});
