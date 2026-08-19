/** Journal d'audit APPEND-ONLY des actions humaines (opposition, ajustement, remboursement,
 *  clôture). Immuable : aucune méthode de modification/suppression n'existe. */
export interface AuditEntry {
  actor: string; action: string; target: string; atIso: string; details?: Record<string, unknown>;
}
export interface AuditLog { append(entry: AuditEntry): Promise<void>; }
