import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { sendcloudConfig } from '../../../shared/config/sendcloudConfig';
import { ResponseHandler } from '../../../shared/utils/responseHandler';

const isValidSignature = (signature: string, expected: string): boolean => {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
};

export const verifySendcloudWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const signature = req.get('Sendcloud-Signature');
  const signatureKey = sendcloudConfig.webhookSignatureKey;

  if (!signatureKey) {
    ResponseHandler.internalServerError(
      res,
      'Sendcloud webhook signature key is not configured',
    );
    return;
  }

  if (!signature) {
    ResponseHandler.unauthorized(
      res,
      'Missing Sendcloud signature',
      'Sendcloud-Signature header is required',
    );
    return;
  }

  const rawBody = (req as any).rawBody;
  const payload = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(JSON.stringify(req.body));
  const expectedSignature = crypto
    .createHmac('sha256', signatureKey)
    .update(payload)
    .digest('hex');

  if (!isValidSignature(signature, expectedSignature)) {
    ResponseHandler.unauthorized(
      res,
      'Invalid Sendcloud signature',
      'Sendcloud webhook signature could not be verified',
    );
    return;
  }

  next();
};
