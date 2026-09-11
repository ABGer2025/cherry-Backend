const mockSendTestEmail = jest.fn();

jest.mock('../services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendTestEmail: mockSendTestEmail,
  })),
}));

import { sendTestResendEmail } from '../controllers/notificationController';

const createResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('notificationController.sendTestResendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a test email through the email service', async () => {
    mockSendTestEmail.mockResolvedValue({
      sent: true,
      skipped: false,
      emailId: 'email-1',
    });

    const req: any = {
      body: {
        to: 'delivered@resend.dev',
      },
    };
    const res = createResponse();

    await sendTestResendEmail(req, res);

    expect(mockSendTestEmail).toHaveBeenCalledWith({
      to: 'delivered@resend.dev',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Test email sent successfully',
        data: {
          sent: true,
          skipped: false,
          emailId: 'email-1',
        },
      }),
    );
  });

  it('returns 500 when Resend rejects the test email', async () => {
    mockSendTestEmail.mockRejectedValue(
      new Error('Resend email failed: validation_error - invalid sender'),
    );

    const req: any = {
      body: {
        to: 'milo@yopmail.com',
      },
    };
    const res = createResponse();

    await sendTestResendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Failed to send Resend test email',
        error: 'Resend email failed: validation_error - invalid sender',
      }),
    );
  });
});
