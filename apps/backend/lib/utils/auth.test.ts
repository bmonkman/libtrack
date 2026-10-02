import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionNeedsExtending } from './auth';

test('a session is extended at most once an hour', () => {
  const lastUsedAt = new Date('2026-10-01T12:00:00Z');
  assert.equal(sessionNeedsExtending(lastUsedAt, new Date('2026-10-01T12:59:59Z')), false);
  assert.equal(sessionNeedsExtending(lastUsedAt, new Date('2026-10-01T13:00:00Z')), true);
  assert.equal(sessionNeedsExtending(lastUsedAt, new Date('2026-12-01T12:00:00Z')), true);
});
