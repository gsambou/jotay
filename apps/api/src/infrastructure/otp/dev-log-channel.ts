import type { OtpChannel, OtpMessage } from '../../application/ports/otp-channel.js';

/** Canal local uniquement (JOTAY_DEV_OTP=1). Ne jamais activer en production. */
export class DevLogOtpChannel implements OtpChannel {
  async send(msisdn: string, message: OtpMessage): Promise<void> {
    console.log(JSON.stringify({
      level: 'warn', msg: 'otp.dev', purpose: message.purpose,
      msisdnTail: msisdn.slice(-3), code: message.code, ttlMinutes: message.ttlMinutes,
    }));
  }
}
