import assert from "node:assert/strict";
import test from "node:test";
import { fill } from "../lib/providers/fill.ts";

test("fills explicit null values as JSON null in body templates", () => {
  assert.equal(fill('{"plan": {plan}}', { plan: null }, "body"), '{"plan": null}');
});

test("rejects null values in provider URL paths", () => {
  assert.throws(
    () => fill("/purchase/{plan}", { plan: null }, "path"),
    /Null value for \{plan\} cannot be used in a provider URL path/,
  );
});
