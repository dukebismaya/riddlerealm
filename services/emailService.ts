import emailjs, { EmailJSResponseStatus } from '@emailjs/browser';

export type OtpEmailPayload = {
  toEmail: string;
  code: string;
  expiresInMinutes: number;
};

export class EmailServiceError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'EmailServiceError';
  }
}

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const isEmailServiceConfigured = () => Boolean(serviceId && templateId && publicKey);

export const sendOtpEmail = async ({ toEmail, code, expiresInMinutes }: OtpEmailPayload): Promise<EmailJSResponseStatus> => {
  if (!isEmailServiceConfigured()) {
    throw new EmailServiceError(
      'EMAIL_CONFIG_MISSING',
      'Email service is not configured. Please provide EmailJS environment variables.',
    );
  }

  try {
    const result = await emailjs.send(
      serviceId as string,
      templateId as string,
      {
        to_email: toEmail,
        otp_code: code,
        expires_in_minutes: expiresInMinutes,
      },
      {
        publicKey: publicKey as string,
      },
    );

    return result;
  } catch (error) {
    if (error instanceof EmailServiceError) {
      throw error;
    }
    throw new EmailServiceError('EMAIL_SEND_FAILED', 'Failed to send the verification code email.');
  }
};
