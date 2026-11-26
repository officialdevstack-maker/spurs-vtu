import assert from "node:assert/strict";
import test from "node:test";
import { hasUnreversedDebit } from "../lib/settlement-ledger.ts";

test("does not mistake undone cashback spend for a debit", () => {
  assert.equal(hasUnreversedDebit(false, true, true), false);
});

test("recognizes wallet and non-undone cashback debits", () => {
  assert.equal(hasUnreversedDebit(true, false, false), true);
  assert.equal(hasUnreversedDebit(false, true, false), true);
  assert.equal(hasUnreversedDebit(false, false, false), false);
});
