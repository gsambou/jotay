export interface BlocklistDelta {
  version: number;
  addedCardUids: string[];
}

export interface BlocklistRepository {
  add(cardUid: string, reason: string, atIso: string): Promise<void>;
  deltaSince(version: number): Promise<BlocklistDelta>;
}
