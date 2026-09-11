import { testResendEmailSchema } from '../validators/notificationValidator';

describe('testResendEmailSchema', () => {
  it('accepts a valid recipient email', () => {
    const { error, value } = testResendEmailSchema.validate({
      to: 'delivered@resend.dev',
    });

    expect(error).toBeUndefined();
    expect(value.to).toBe('delivered@resend.dev');
  });

  it('rejects an invalid recipient email', () => {
    const { error } = testResendEmailSchema.validate({
      to: 'not-an-email',
    });

    expect(error).toBeDefined();
  });
});
