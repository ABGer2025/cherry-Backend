import { Request, Response } from 'express';
import { ResponseHandler } from '../../../shared/utils/responseHandler';
import { EmailService } from '../services/EmailService';

export const sendTestResendEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { to } = req.body as { to: string };
    const emailService = new EmailService();
    const result = await emailService.sendTestEmail({ to });

    ResponseHandler.success(
      res,
      result,
      result.sent ? 'Test email sent successfully' : 'Test email skipped',
    );
  } catch (err) {
    console.error('Failed to send Resend test email:', err);
    ResponseHandler.internalServerError(
      res,
      'Failed to send Resend test email',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
};
