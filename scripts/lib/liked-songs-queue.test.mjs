import { describe, it, expect } from 'vitest';
import { syncQueue, pruneArchived, planFill } from './liked-songs-queue.mjs';

const track = (id, order) => ({ id, addedAt: new Date(Date.UTC(2026, 0, 1, 0, order)).toISOString() });

describe('syncQueue', () => {
  it('appends liked songs not already in the queue, sorted oldest-first', () => {
    const queue = [track('a', 1)];
    const liked = [track('c', 3), track('a', 1), track('b', 2)];
    const result = syncQueue(queue, liked);
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate a track already in the queue', () => {
    const queue = [track('a', 1)];
    const liked = [track('a', 1)];
    const result = syncQueue(queue, liked);
    expect(result).toHaveLength(1);
  });
});

describe('pruneArchived', () => {
  it('removes queue entries whose id is already archived', () => {
    const queue = [track('a', 1), track('b', 2)];
    const result = pruneArchived(queue, new Set(['a']));
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('is a no-op when nothing in the queue is archived', () => {
    const queue = [track('a', 1)];
    expect(pruneArchived(queue, new Set(['unrelated']))).toEqual(queue);
  });
});

describe('planFill', () => {
  it('tops off an open archive without creating a new one when fewer than 30 pending exist', () => {
    const queue = [track('a', 1), track('b', 2)];
    const plan = planFill(queue, { trackCount: 22 });
    expect(plan.topOff.map((t) => t.id)).toEqual(['a', 'b']);
    expect(plan.newArchives).toEqual([]);
    expect(plan.remaining).toEqual([]);
  });

  it("caps top-off at the open archive's remaining slots and leaves the rest pending", () => {
    const queue = Array.from({ length: 10 }, (_, i) => track(`t${i}`, i + 1));
    const plan = planFill(queue, { trackCount: 22 }); // 8 slots open
    expect(plan.topOff).toHaveLength(8);
    expect(plan.newArchives).toEqual([]);
    expect(plan.remaining).toHaveLength(2);
  });

  it('tops off, then creates one new archive when enough pending remain', () => {
    const queue = Array.from({ length: 40 }, (_, i) => track(`t${i}`, i + 1));
    const plan = planFill(queue, { trackCount: 22 }); // 8 slots, then 32 left -> one batch of 30, 2 remain
    expect(plan.topOff).toHaveLength(8);
    expect(plan.newArchives).toHaveLength(1);
    expect(plan.newArchives[0]).toHaveLength(30);
    expect(plan.remaining).toHaveLength(2);
  });

  it('creates multiple new archives when there is no open archive and enough pending accumulate', () => {
    const queue = Array.from({ length: 65 }, (_, i) => track(`t${i}`, i + 1));
    const plan = planFill(queue, null);
    expect(plan.topOff).toEqual([]);
    expect(plan.newArchives).toHaveLength(2);
    expect(plan.remaining).toHaveLength(5);
  });

  it('produces no remainder when pending is an exact multiple of 30', () => {
    const queue = Array.from({ length: 30 }, (_, i) => track(`t${i}`, i + 1));
    const plan = planFill(queue, null);
    expect(plan.newArchives).toHaveLength(1);
    expect(plan.remaining).toEqual([]);
  });

  it('archives the oldest pending tracks first', () => {
    const queue = [track('newest', 3), track('oldest', 1), track('middle', 2)];
    const plan = planFill(queue, { trackCount: 29 });
    expect(plan.topOff.map((t) => t.id)).toEqual(['oldest']);
  });
});
