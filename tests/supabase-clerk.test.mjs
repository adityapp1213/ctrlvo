import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

test('supabase health endpoint responds with ok and clerk ids', async () => {
  // Allow dev server startup delay; expect server to be running separately.
  await delay(100);
  const res = await fetch('http://localhost:3000/api/supabase/health', {
    headers: { 'Accept': 'application/json' },
  }).catch(() => null);

  assert.ok(res, 'fetch failed; make sure `npm run dev` is running');
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.ok('clerk' in json);
  assert.ok('supabaseAuthHeader' in json);
});

