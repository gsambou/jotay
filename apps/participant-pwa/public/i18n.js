// Messages du portail — fr par défaut, en (anglais) pour l'expansion sous-régionale.
// Sélection : ?lang=en ou navigator.language. Zéro dépendance (ADR-003).
export const MESSAGES = {
  fr: {
    title: 'Jotay — Mon portefeuille',
    enterPhone: 'Entrez votre numéro pour recevoir un code par WhatsApp.',
    receiveCode: 'Recevoir le code',
    invalidPhone: 'Numéro invalide.',
    codeSent: 'Code envoyé par WhatsApp. Saisissez-le ci-dessous.',
    validate: 'Valider',
    invalidCode: 'Code invalide ou expiré.',
    balanceUnit: 'FCFA',
    updatedAt: 'À jour à',
    frozen: 'Portefeuille gelé — contactez un superviseur.',
    askRefund: 'Demander le remboursement',
    offline: 'Hors ligne — solde peut-être daté, actions désactivées.',
    refundRecorded: 'Demande enregistrée',
    noPayout: "Aucun numéro de remboursement vérifié. Associez-en un d'abord.",
    refundRefused: 'Refusé. Vérifiez votre PIN.',
    expenses: 'Dépenses',
  },
  en: {
    title: 'Jotay — My wallet',
    enterPhone: 'Enter your number to receive a code by WhatsApp.',
    receiveCode: 'Get the code',
    invalidPhone: 'Invalid number.',
    codeSent: 'Code sent by WhatsApp. Enter it below.',
    validate: 'Confirm',
    invalidCode: 'Invalid or expired code.',
    balanceUnit: 'FCFA',
    updatedAt: 'Updated at',
    frozen: 'Wallet frozen — please contact a supervisor.',
    askRefund: 'Request a refund',
    offline: 'Offline — balance may be outdated, actions disabled.',
    refundRecorded: 'Request recorded',
    noPayout: 'No verified refund number. Please link one first.',
    refundRefused: 'Declined. Check your PIN.',
    expenses: 'Spending',
  },
};
export function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  const l = q || (navigator.language || 'fr').slice(0, 2);
  return MESSAGES[l] ? l : 'fr';
}
export const t = (lang) => MESSAGES[lang] ?? MESSAGES.fr;
