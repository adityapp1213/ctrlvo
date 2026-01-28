import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

async function fetchJson(path) {
  await delay(100);
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Accept: "application/json" },
  }).catch(() => null);
  assert.ok(res, "fetch failed; make sure `npm run dev` is running");
  assert.equal(res.status, 200);
  return res.json();
}

test("AI search health endpoint returns intent for empty query", async () => {
  const json = await fetchJson("/api/ai/search-health?q=");
  assert.equal(json.ok, true);
  assert.equal(json.intent.shouldShowTabs, false);
  assert.equal(json.intent.searchQuery, null);
});

test("AI search health endpoint returns structure for non-empty query", async () => {
  const json = await fetchJson("/api/ai/search-health?q=test");
  assert.equal(json.ok, true);
  assert.ok(json.intent);
  assert.ok(typeof json.webCount === "number");
  assert.ok(typeof json.imageCount === "number");
  assert.ok(typeof json.summaryLines === "number");
});

