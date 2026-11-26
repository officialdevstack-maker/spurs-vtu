export function hasUnreversedDebit(walletDebit: boolean, cashbackDebit: boolean, cashbackUndo: boolean): boolean {
  return walletDebit || (cashbackDebit && !cashbackUndo);
}
