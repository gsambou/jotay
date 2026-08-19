/** Rendu d'un QR en SVG (affichage du jeton tournant). Implémentation en infra. */
export interface QrRenderer { toSvg(payload: string): Promise<string>; }
