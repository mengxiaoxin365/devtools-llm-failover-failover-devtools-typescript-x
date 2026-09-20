import assert from "node:assert/strict";
import { chooseVendor, makeHandoff } from "./failover_decision.js";

assert.equal(chooseVendor(0, true), "primary");
assert.equal(chooseVendor(1, true), "secondary");
assert.equal(chooseVendor(0, false), "secondary");
assert.deepEqual(makeHandoff({ buildId: "b1", release: "v1", diagnostics: "lint clean" }, 1, true), {
  buildId: "b1", release: "v1", diagnostics: "lint clean", vendor: "secondary",
  prompt: "Release v1 for build b1. Diagnostics: lint clean",
});
console.log("failover decision test passed");
