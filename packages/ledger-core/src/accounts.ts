/** Plan de comptes — cf. SPEC chap. 6.7. */
export type AccountId =
  | 'liability:wallets'
  | `liability:vendor_payable:${string}`
  | 'asset:float_partner'
  | `asset:cash_drawer:${string}`
  | 'revenue:fees'
  | 'expense:refunds_costs'
  | 'suspense:quarantine';
