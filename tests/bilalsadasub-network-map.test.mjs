import assert from "node:assert/strict";
import test from "node:test";
import { mergeBilalsadasubNetworkCodes } from "../lib/providers/bilalsadasub-network-map.ts";

test("maps Bilalsadasub network names case-insensitively and preserves unrelated codes", () => {
  const result = mergeBilalsadasubNetworkCodes(
    [
      { name: "MTN", id: "1" },
      { name: "9MOBILE", id: "4" },
      { name: "UNKNOWN", id: "9" },
    ],
    [
      { id: "mtn", name: "MTN" },
      { id: "9mobile", name: "9mobile" },
      { id: "airtel", name: "Airtel" },
    ],
    { airtel: "2", custom: "kept" },
  );

  assert.deepEqual(result, {
    codes: { airtel: "2", custom: "kept", mtn: "1", "9mobile": "4" },
    matched: 2,
  });
});

test("leaves all existing codes unchanged when no network names match", () => {
  const result = mergeBilalsadasubNetworkCodes(
    [{ name: "UNKNOWN", id: "9" }],
    [{ id: "mtn", name: "MTN" }],
    { mtn: "1" },
  );

  assert.deepEqual(result, { codes: { mtn: "1" }, matched: 0 });
});
