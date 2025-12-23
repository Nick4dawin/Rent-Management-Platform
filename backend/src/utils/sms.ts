import { CONFIG } from '../config';
import logger from '../config/logger';

interface SMSMessage {
  to: string;
  message: string;
}

/**
 * Send SMS via configured provider
 */
export async function sendSMS(data: SMSMessage): Promise<boolean> {
  try {
    if (CONFIG.SMS_PROVIDER === 'twilio') {
      return await sendTwilioSMS(data);
    }

    // Add more SMS providers here
    logger.warn(`SMS provider ${CONFIG.SMS_PROVIDER} not implemented`);
    return false;
  } catch (error) {
    logger.error('Failed to send SMS:', error);
    return false;
  }
}

/**
 * Send SMS via Twilio
 */
async function sendTwilioSMS(data: SMSMessage): Promise<boolean> {
  // In development, just log the SMS
  if (CONFIG.NODE_ENV === 'development') {
    logger.info(`[DEV] SMS to ${data.to}: ${data.message}`);
    return true;
  }

  // TODO: Implement actual Twilio integration
  // const twilio = require('twilio');
  // const client = twilio(CONFIG.TWILIO_ACCOUNT_SID, CONFIG.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: data.message,
  //   from: CONFIG.TWILIO_PHONE_NUMBER,
  //   to: data.to,
  // });

  logger.info(`SMS sent to ${data.to}`);
  return true;
}

/**
 * Send verification SMS
 */
export async function sendVerificationSMS(phone: string, code: string): Promise<boolean> {
  const message = `Your verification code is: ${code}. Valid for 10 minutes.`;
  return sendSMS({ to: phone, message });
}

/**
 * Send notification SMS
 */
export async function sendNotificationSMS(phone: string, message: string): Promise<boolean> {
  return sendSMS({ to: phone, message });
}
