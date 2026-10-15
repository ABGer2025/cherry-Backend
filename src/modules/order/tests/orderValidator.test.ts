import { validateOrder } from '../validators/orderValidator';

const createResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('orderValidator', () => {
  it('rejects order confirmation when orderId is missing', () => {
    const req: any = {
      body: {
        paymentIntentId: 'pi_123',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    validateOrder(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts a valid order confirmation payload', () => {
    const req: any = {
      body: {
        orderId: 'order-1',
        paymentIntentId: 'pi_123',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    validateOrder(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ignores client-provided pricing fields', () => {
    const req: any = {
      body: {
        orderId: 'order-1',
        paymentIntentId: 'pi_123',
        amount: 2599,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    validateOrder(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.amount).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });
});
