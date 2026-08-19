/**
 * Transport d'OTP — AGNOSTIQUE du canal. Adapter par défaut : WhatsApp ; SMS en repli.
 * Passer de WhatsApp à SMS ne touche QUE l'adapter, jamais les use cases (OCP/DIP).
 */
export interface OtpMessage {
  code: string;
  purpose: 'PORTAL_LOGIN';
  /** Durée de validité en minutes, pour le libellé du message. */
  ttlMinutes: number;
}
export interface OtpChannel {
  send(msisdn: string, message: OtpMessage): Promise<void>;
}
