# Liked-Songs Archive Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate Pedro's manual "like songs → seal a 30-song playlist → rebuild the site" process for `~/personal_projects/digital-archives`, so a weekly check moves newly-liked songs into "Digital Archive #NNN" playlists and refreshes the site data without manual intervention.

**Architecture:** Extends the existing `scripts/lib/*.mjs` + DI `run()` + vitest pattern already used by `build-archives.mjs`. Three new pure-logic pieces (Spotify API calls, ledger sync/fill-planning, archived-ID collection) feed a new orchestrator script, `scripts/archive-liked-songs.mjs`, which is safe to dry-run and reuses `build-archives.mjs`'s regeneration logic directly.

**Tech Stack:** Node ESM (`"type": "module"`), `dotenv`, `vitest`, no framework — plain `fetch`-based Spotify Web API calls, dependency-injected for testability.

**Spec:** `docs/superpowers/specs/2026-09-01-liked-songs-archive-automation-design.md`

## Global Constraints

- ESM syntax throughout (`import`/`export`), matching every existing file in `scripts/`.
- Single quotes, 2-space indent, semicolons — matches existing files exactly; don't introduce a different style.
- No comments except where a WHY is genuinely non-obvious (existing files do this sparingly — see `spotify-client.mjs`'s Retry-After comment for the bar to clear).
- Every new pure-logic function takes its dependencies (especially `fetchImpl`) as parameters, never imports `fetch` directly — this is what makes the existing test suite mock-friendly, and it must stay that way.
- Track/playlist field names must match the existing conventions exactly: `id`, `name`, `artists` (array of strings), `addedAt`, `spotifyUrl`, `unavailable` (see `spotify-api.mjs`'s `fetchPlaylistTracks`). New ledger entries additionally carry `uri` (needed to add tracks to a playlist) but skip fields the ledger doesn't need (`album`, `coverUrl`, `releaseDate`, `durationMs`, `spotifyUrl`, `unavailable`).
- Archive playlists are always named `Digital Archive #NNN` (matches `ARCHIVE_NAME_PATTERN` in `build-archives.mjs`), public, non-collaborative — verified against all 29 existing archives on Pedro's account.
- Nothing in this feature un-likes a song or removes anything from Spotify's Liked Songs — that was explicitly rejected in the spec.

---

### Task 1: `spotifyFetch` gains POST support; OAuth scopes expand

**Files:**
- Modify: `scripts/lib/spotify-client.mjs` (the `spotifyFetch` function)
- Modify: `scripts/lib/spotify-client.test.mjs`
- Modify: `scripts/authorize.mjs` (the `SCOPES` constant — export it)
- Modify: `scripts/authorize.test.mjs`

**Interfaces:**
- Produces: `spotifyFetch(token, path, fetchImpl = fetch, options = {})` where `options` may include `{ method = 'GET', body, retryCount = 0 }`. Passing no 4th argument behaves exactly as before (GET, no body) — every existing call site (`fetchAllPlaylists`, `fetchPlaylistTracks`) needs zero changes.
- Produces: `SCOPES` exported from `authorize.mjs`, now including `user-library-read` and `playlist-modify-public` alongside the existing `playlist-read-private`/`playlist-read-collaborative`.

- [ ] **Step 1: Write the failing tests for POST support**

Add to `scripts/lib/spotify-client.test.mjs`, inside the existing `describe('spotifyFetch', ...)` block:

```js
  it('sends method and JSON body when options include them, and sets Content-Type', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'new-playlist' }) });
    const result = await spotifyFetch('tok', '/users/u1/playlists', fakeFetch, {
      method: 'POST',
      body: { name: 'Digital Archive #30', public: true },
    });
    expect(result).toEqual({ id: 'new-playlist' });
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/users/u1/playlists');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Digital Archive #30', public: true });
  });

  it('still defaults to a GET with no body when no options are passed', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'abc' }) });
    await spotifyFetch('tok', '/me', fakeFetch);
    const [, init] = fakeFetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- spotify-client`
Expected: FAIL — `init.method` is `undefined` (no `method` key sent today), `init.headers['Content-Type']` assertion fails since POST/body aren't supported yet.

- [ ] **Step 3: Implement POST support in `spotifyFetch`**

Replace the existing `spotifyFetch` function in `scripts/lib/spotify-client.mjs` with:

```js
export async function spotifyFetch(token, path, fetchImpl = fetch, options = {}) {
  const { method = 'GET', body, retryCount = 0 } = options;
  const res = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 429) {
    if (retryCount >= 4) {
      throw new Error(`Spotify API rate limit exceeded after 5 attempts: ${path}`);
    }
    // Retry-After is *usually* a delay in seconds, but per HTTP spec it may legally be
    // an HTTP-date instead — guard against that (and any other non-numeric value)
    // turning into NaN, which would otherwise skip the backoff delay entirely.
    const raw = res.headers.get('Retry-After');
    const retryAfter = raw && Number.isFinite(Number(raw)) ? Number(raw) : 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return spotifyFetch(token, path, fetchImpl, { method, body, retryCount: retryCount + 1 });
  }
  if (!res.ok) {
    throw new Error(`Spotify API request failed (${res.status}): ${path}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- spotify-client`
Expected: PASS — all existing tests (429 retry, 404 throw, HTTP-date fallback) plus the two new ones.

- [ ] **Step 5: Write the failing test for expanded scopes**

Add to `scripts/authorize.test.mjs`:

```js
import { SCOPES } from './authorize.mjs';

describe('SCOPES', () => {
  it('includes the scopes needed to read Liked Songs and create/edit playlists', () => {
    expect(SCOPES).toEqual(
      expect.arrayContaining([
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'playlist-modify-public',
      ])
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- authorize`
Expected: FAIL — `SCOPES` is not exported yet and doesn't include the new scopes.

- [ ] **Step 7: Export and expand `SCOPES`**

In `scripts/authorize.mjs`, change:

```js
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative'];
```

to:

```js
export const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'playlist-modify-public',
];
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- authorize`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/spotify-client.mjs scripts/lib/spotify-client.test.mjs scripts/authorize.mjs scripts/authorize.test.mjs
git commit -m "$(cat <<'EOF'
Add POST support to spotifyFetch and expand OAuth scopes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `fetchLikedSongs`

**Files:**
- Modify: `scripts/lib/spotify-api.mjs`
- Modify: `scripts/lib/spotify-api.test.mjs`

**Interfaces:**
- Consumes: `spotifyFetch(token, path, fetchImpl)` from Task 1 (already imported in this file).
- Produces: `fetchLikedSongs(token, knownIds = new Set(), fetchImpl)` → `Promise<Array<{id, name, artists, addedAt, uri}>>`. Pages `/me/tracks` newest-first, stopping as soon as it hits a track ID present in `knownIds`.

- [ ] **Step 1: Write the failing tests**

Add to `scripts/lib/spotify-api.test.mjs`:

```js
import { fetchLikedSongs } from './spotify-api.mjs';

describe('fetchLikedSongs', () => {
  it('maps saved-track items to the ledger shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-02T00:00:00Z', track: { id: 't2', name: 'Song B', uri: 'spotify:track:t2', artists: [{ name: 'Artist B' }] } },
          { added_at: '2026-02-01T00:00:00Z', track: { id: 't1', name: 'Song A', uri: 'spotify:track:t1', artists: [{ name: 'Artist A' }] } },
        ],
        next: null,
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(), fetchImpl);
    expect(tracks).toEqual([
      { id: 't2', name: 'Song B', artists: ['Artist B'], addedAt: '2026-02-02T00:00:00Z', uri: 'spotify:track:t2' },
      { id: 't1', name: 'Song A', artists: ['Artist A'], addedAt: '2026-02-01T00:00:00Z', uri: 'spotify:track:t1' },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toContain('/me/tracks');
  });

  it('stops paging once it reaches a track id already in knownIds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-03T00:00:00Z', track: { id: 'new1', name: 'New Song', uri: 'spotify:track:new1', artists: [{ name: 'Artist' }] } },
          { added_at: '2026-02-02T00:00:00Z', track: { id: 'seen1', name: 'Seen Song', uri: 'spotify:track:seen1', artists: [{ name: 'Artist' }] } },
        ],
        next: 'https://api.spotify.com/v1/me/tracks?offset=50',
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(['seen1']), fetchImpl);
    expect(tracks).toEqual([
      { id: 'new1', name: 'New Song', artists: ['Artist'], addedAt: '2026-02-03T00:00:00Z', uri: 'spotify:track:new1' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('skips local files (no catalog id) and null tracks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-01T00:00:00Z', track: null },
          { added_at: '2026-02-01T00:00:00Z', track: { id: null, name: 'Local File', is_local: true, artists: [] } },
          { added_at: '2026-02-01T00:00:00Z', track: { id: 't1', name: 'Real Song', uri: 'spotify:track:t1', artists: [{ name: 'Artist' }] } },
        ],
        next: null,
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(), fetchImpl);
    expect(tracks).toEqual([
      { id: 't1', name: 'Real Song', artists: ['Artist'], addedAt: '2026-02-01T00:00:00Z', uri: 'spotify:track:t1' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- spotify-api`
Expected: FAIL with "fetchLikedSongs is not a function" or import error.

- [ ] **Step 3: Implement `fetchLikedSongs`**

Add to `scripts/lib/spotify-api.mjs`:

```js
export async function fetchLikedSongs(token, knownIds = new Set(), fetchImpl) {
  const tracks = [];
  let url = `/me/tracks?limit=50`;
  let stop = false;
  while (url && !stop) {
    const page = await spotifyFetch(token, url, fetchImpl);
    for (const item of page.items) {
      const t = item.track;
      if (!t || t.is_local) continue;
      if (knownIds.has(t.id)) {
        stop = true;
        break;
      }
      tracks.push({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        addedAt: item.added_at,
        uri: t.uri,
      });
    }
    url = !stop && page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- spotify-api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/spotify-api.mjs scripts/lib/spotify-api.test.mjs
git commit -m "$(cat <<'EOF'
Add fetchLikedSongs with early-stop pagination

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**IMPORTANT — flag for manual verification later:** `/me/tracks`'s per-item track key is assumed to be `track` (Spotify's documented shape for "Get User's Saved Tracks"), unlike `/playlists/{id}/items`'s `item` key used elsewhere in this file (verified live against Pedro's account during design). This file's current OAuth token lacks `user-library-read`, so `track` vs `item` could not be verified live during planning. Task 7 (manual end-to-end verification) must confirm this against a real `/me/tracks` response before trusting production runs — if it's wrong, `fetchLikedSongs` will return an empty list silently rather than erroring, so this needs an explicit look, not just "no crash."

---

### Task 3: `createPlaylist` and `addTracksToPlaylist`

**Files:**
- Modify: `scripts/lib/spotify-api.mjs`
- Modify: `scripts/lib/spotify-api.test.mjs`

**Interfaces:**
- Consumes: `spotifyFetch(token, path, fetchImpl, options)` from Task 1.
- Produces: `createPlaylist(token, userId, name, fetchImpl)` → `Promise<{id, ...}>` (POSTs `{name, public: true, collaborative: false}`).
- Produces: `addTracksToPlaylist(token, playlistId, uris, fetchImpl)` → `Promise<void>` (chunks `uris` at 100 per Spotify's per-call limit).

- [ ] **Step 1: Write the failing tests**

Add to `scripts/lib/spotify-api.test.mjs`:

```js
import { createPlaylist, addTracksToPlaylist } from './spotify-api.mjs';

describe('createPlaylist', () => {
  it('POSTs to /users/{id}/playlists with name, public:true, collaborative:false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'new-pl' }) });
    const playlist = await createPlaylist('tok', 'u1', 'Digital Archive #30', fetchImpl);
    expect(playlist).toEqual({ id: 'new-pl' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/users/u1/playlists');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Digital Archive #30', public: true, collaborative: false });
  });
});

describe('addTracksToPlaylist', () => {
  it('POSTs all uris in one call when 100 or fewer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ snapshot_id: 's1' }) });
    const uris = Array.from({ length: 30 }, (_, i) => `spotify:track:t${i}`);
    await addTracksToPlaylist('tok', 'pl1', uris, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/playlists/pl1/tracks');
    expect(JSON.parse(init.body).uris).toHaveLength(30);
  });

  it('chunks into multiple calls of at most 100 uris', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ snapshot_id: 's1' }) });
    const uris = Array.from({ length: 130 }, (_, i) => `spotify:track:t${i}`);
    await addTracksToPlaylist('tok', 'pl1', uris, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).uris).toHaveLength(100);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).uris).toHaveLength(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- spotify-api`
Expected: FAIL — `createPlaylist`/`addTracksToPlaylist` not defined.

- [ ] **Step 3: Implement both functions**

Add to `scripts/lib/spotify-api.mjs`:

```js
export async function createPlaylist(token, userId, name, fetchImpl) {
  return spotifyFetch(token, `/users/${userId}/playlists`, fetchImpl, {
    method: 'POST',
    body: { name, public: true, collaborative: false },
  });
}

export async function addTracksToPlaylist(token, playlistId, uris, fetchImpl) {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyFetch(token, `/playlists/${playlistId}/tracks`, fetchImpl, {
      method: 'POST',
      body: { uris: chunk },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- spotify-api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/spotify-api.mjs scripts/lib/spotify-api.test.mjs
git commit -m "$(cat <<'EOF'
Add createPlaylist and addTracksToPlaylist

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Ledger fill-planning and archived-ID collection (pure logic)

**Files:**
- Create: `scripts/lib/liked-songs-queue.mjs`
- Create: `scripts/lib/liked-songs-queue.test.mjs`
- Create: `scripts/lib/archived-tracks.mjs`
- Create: `scripts/lib/archived-tracks.test.mjs`

**Interfaces:**
- Produces: `syncQueue(queue, likedSongs)` → merged array, oldest-first by `addedAt`, deduped by `id`.
- Produces: `pruneArchived(queue, archivedTrackIds)` → array with any entry whose `id` is in `archivedTrackIds` (a `Set`) removed.
- Produces: `planFill(queue, openArchive)` → `{ topOff: Track[], newArchives: Track[][], remaining: Track[] }`. `openArchive` is either `null` (no open playlist — the latest archive is full or none exist) or `{ id, trackCount }` (`trackCount` in `0..29`). `topOff` never exceeds `30 - openArchive.trackCount`; each entry of `newArchives` has exactly 30 tracks; `remaining` is whatever's left (always `< 30`).
- Produces: `collectArchivedTrackIds(archiveSummaries)` → `Set<string>`, where `archiveSummaries` is an array of parsed `public/data/archive-*.json` contents (`{ tracks: [{id, unavailable}, ...] }`), excluding `unavailable` placeholder tracks.

- [ ] **Step 1: Write the failing tests for `liked-songs-queue.mjs`**

Create `scripts/lib/liked-songs-queue.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- liked-songs-queue`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `liked-songs-queue.mjs`**

Create `scripts/lib/liked-songs-queue.mjs`:

```js
export function syncQueue(queue, likedSongs) {
  const existingIds = new Set(queue.map((t) => t.id));
  const additions = likedSongs.filter((t) => !existingIds.has(t.id));
  return [...queue, ...additions].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
}

export function pruneArchived(queue, archivedTrackIds) {
  return queue.filter((t) => !archivedTrackIds.has(t.id));
}

export function planFill(queue, openArchive) {
  const sorted = [...queue].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  let cursor = 0;
  let topOff = [];
  if (openArchive) {
    const slots = Math.max(0, 30 - openArchive.trackCount);
    topOff = sorted.slice(0, slots);
    cursor = topOff.length;
  }
  const newArchives = [];
  while (sorted.length - cursor >= 30) {
    newArchives.push(sorted.slice(cursor, cursor + 30));
    cursor += 30;
  }
  const remaining = sorted.slice(cursor);
  return { topOff, newArchives, remaining };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- liked-songs-queue`
Expected: PASS

- [ ] **Step 5: Write the failing tests for `archived-tracks.mjs`**

Create `scripts/lib/archived-tracks.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { collectArchivedTrackIds } from './archived-tracks.mjs';

describe('collectArchivedTrackIds', () => {
  it('collects track ids across all archives, excluding unavailable placeholders', () => {
    const archives = [
      { tracks: [{ id: 't1', unavailable: false }, { id: 'archive-001-unavailable-3', unavailable: true }] },
      { tracks: [{ id: 't2', unavailable: false }] },
    ];
    expect(collectArchivedTrackIds(archives)).toEqual(new Set(['t1', 't2']));
  });

  it('returns an empty set for no archives', () => {
    expect(collectArchivedTrackIds([])).toEqual(new Set());
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- archived-tracks`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 7: Implement `archived-tracks.mjs`**

Create `scripts/lib/archived-tracks.mjs`:

```js
export function collectArchivedTrackIds(archiveSummaries) {
  const ids = new Set();
  for (const archive of archiveSummaries) {
    for (const track of archive.tracks ?? []) {
      if (!track.unavailable) ids.add(track.id);
    }
  }
  return ids;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- archived-tracks`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/liked-songs-queue.mjs scripts/lib/liked-songs-queue.test.mjs scripts/lib/archived-tracks.mjs scripts/lib/archived-tracks.test.mjs
git commit -m "$(cat <<'EOF'
Add ledger fill-planning and archived-track-id collection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Orchestrator script — `archive-liked-songs.mjs`

**Files:**
- Create: `scripts/archive-liked-songs.mjs`
- Create: `scripts/archive-liked-songs.test.mjs`
- Modify: `package.json` (add `archive-liked-songs` and `archive-liked-songs:dry-run` scripts)

**Interfaces:**
- Consumes: `fetchLikedSongs`, `createPlaylist`, `addTracksToPlaylist` (Tasks 2-3), `syncQueue`, `pruneArchived`, `planFill` (Task 4), `collectArchivedTrackIds` (Task 4), `parseArchiveNumber` and `run` (aliased `buildArchives`) from `build-archives.mjs` (existing).
- Produces: `run({ token, userId, queue, archivedTrackIds, fetchLikedSongs, fetchAllPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist, log })` → `Promise<{ queue, addedCount, createdCount, pendingCount }>`. `queue` in the result is the pruned/updated ledger (pending tracks only) to be persisted.
- Produces: `npm run archive-liked-songs` (live) and `npm run archive-liked-songs:dry-run` (logs the plan, makes no Spotify writes and no file writes) entry points.

- [ ] **Step 1: Write the failing tests**

Create `scripts/archive-liked-songs.test.mjs`:

```js
import { describe, it, expect, vi } from 'vitest';
import { run } from './archive-liked-songs.mjs';

const track = (id, order) => ({
  id,
  name: `Song ${id}`,
  artists: ['Artist'],
  addedAt: new Date(Date.UTC(2026, 0, 1, 0, order)).toISOString(),
  uri: `spotify:track:${id}`,
});

describe('run', () => {
  it('creates the first archive when none exist and exactly 30 are pending', async () => {
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const queue = Array.from({ length: 30 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([]),
      fetchPlaylistTracks: vi.fn(),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(createPlaylist).toHaveBeenCalledWith('tok', 'u1', 'Digital Archive #1');
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'new-pl', queue.map((t) => t.uri));
    expect(result).toEqual({ queue: [], addedCount: 30, createdCount: 1, pendingCount: 0 });
  });

  it('tops off an open archive without creating a new one', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn();
    const queue = Array.from({ length: 5 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 22 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl29', queue.map((t) => t.uri));
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(result).toEqual({ queue: [], addedCount: 5, createdCount: 0, pendingCount: 0 });
  });

  it('tops off the open archive then creates a new one for the overflow', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const queue = Array.from({ length: 40 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 22 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(addTracksToPlaylist).toHaveBeenNthCalledWith(1, 'tok', 'pl29', queue.slice(0, 8).map((t) => t.uri));
    expect(createPlaylist).toHaveBeenCalledWith('tok', 'u1', 'Digital Archive #30');
    expect(addTracksToPlaylist).toHaveBeenNthCalledWith(2, 'tok', 'new-pl', queue.slice(8, 38).map((t) => t.uri));
    expect(result.createdCount).toBe(1);
    expect(result.addedCount).toBe(38);
    expect(result.pendingCount).toBe(2);
  });

  it('creates multiple new archives numbered after the latest existing one when it is already full', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn().mockResolvedValueOnce({ id: 'pl-a' }).mockResolvedValueOnce({ id: 'pl-b' });
    const queue = Array.from({ length: 65 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(createPlaylist).toHaveBeenNthCalledWith(1, 'tok', 'u1', 'Digital Archive #30');
    expect(createPlaylist).toHaveBeenNthCalledWith(2, 'tok', 'u1', 'Digital Archive #31');
    expect(result.createdCount).toBe(2);
    expect(result.pendingCount).toBe(5);
  });

  it('drops queue entries that are already archived, and passes the union of queue+archived ids as knownIds', async () => {
    const fetchLikedSongs = vi.fn().mockResolvedValue([]);
    const queue = [track('already-archived', 0), track('still-pending', 1)];

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(['already-archived', 'from-a-past-archive']),
      fetchLikedSongs,
      fetchAllPlaylists: vi.fn().mockResolvedValue([]),
      fetchPlaylistTracks: vi.fn(),
      createPlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn(),
      log: vi.fn(),
    });

    expect(result.queue.map((t) => t.id)).toEqual(['still-pending']);
    const knownIds = fetchLikedSongs.mock.calls[0][1];
    expect(knownIds).toEqual(new Set(['already-archived', 'still-pending', 'from-a-past-archive']));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- archive-liked-songs`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `archive-liked-songs.mjs`**

Create `scripts/archive-liked-songs.mjs`:

```js
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getAccessTokenFromRefreshToken } from './lib/spotify-client.mjs';
import {
  fetchAllPlaylists,
  fetchPlaylistTracks,
  fetchLikedSongs,
  createPlaylist,
  addTracksToPlaylist,
} from './lib/spotify-api.mjs';
import { syncQueue, pruneArchived, planFill } from './lib/liked-songs-queue.mjs';
import { collectArchivedTrackIds } from './lib/archived-tracks.mjs';
import { parseArchiveNumber, run as buildArchives } from './build-archives.mjs';

export async function run({
  token,
  userId,
  queue,
  archivedTrackIds,
  fetchLikedSongs: fetchLikedSongsFn,
  fetchAllPlaylists: fetchAllPlaylistsFn,
  fetchPlaylistTracks: fetchPlaylistTracksFn,
  createPlaylist: createPlaylistFn,
  addTracksToPlaylist: addTracksToPlaylistFn,
  log = console.log,
}) {
  const knownIds = new Set([...queue.map((t) => t.id), ...archivedTrackIds]);
  const likedSongs = await fetchLikedSongsFn(token, knownIds);

  let updatedQueue = syncQueue(queue, likedSongs);
  updatedQueue = pruneArchived(updatedQueue, archivedTrackIds);

  const playlists = await fetchAllPlaylistsFn(token);
  const archives = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null)
    .sort((a, b) => b.number - a.number);

  const latest = archives[0] ?? null;
  let openArchive = null;
  if (latest) {
    const latestTracks = await fetchPlaylistTracksFn(token, latest.id);
    if (latestTracks.length < 30) {
      openArchive = { id: latest.id, trackCount: latestTracks.length };
    }
  }

  const plan = planFill(updatedQueue, openArchive);

  let addedCount = 0;
  if (plan.topOff.length > 0) {
    await addTracksToPlaylistFn(token, openArchive.id, plan.topOff.map((t) => t.uri));
    addedCount += plan.topOff.length;
  }

  let nextNumber = latest ? latest.number + 1 : 1;
  let createdCount = 0;
  for (const batch of plan.newArchives) {
    const playlist = await createPlaylistFn(token, userId, `Digital Archive #${nextNumber}`);
    await addTracksToPlaylistFn(token, playlist.id, batch.map((t) => t.uri));
    addedCount += batch.length;
    createdCount += 1;
    nextNumber += 1;
  }

  log(
    `Synced ${likedSongs.length} liked song(s). ` +
      `Added ${addedCount} track(s) (${createdCount} new archive(s) created). ` +
      `${plan.remaining.length} pending.`
  );

  return { queue: plan.remaining, addedCount, createdCount, pendingCount: plan.remaining.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dataDir = new URL('../public/data/', import.meta.url);
  const stateDir = new URL('./state/', import.meta.url);
  const statePath = fileURLToPath(new URL('liked-songs-queue.json', stateDir));

  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('SPOTIFY_REFRESH_TOKEN is not set — run npm run authorize first');
  }
  const userId = process.env.SPOTIFY_USER_ID;
  if (!userId) {
    throw new Error('SPOTIFY_USER_ID is not set — add it to .env');
  }

  const token = await getAccessTokenFromRefreshToken({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken,
  });

  const archiveFiles = existsSync(dataDir)
    ? readdirSync(dataDir).filter((f) => /^archive-\d+\.json$/.test(f))
    : [];
  const archiveSummaries = archiveFiles.map((f) => JSON.parse(readFileSync(new URL(f, dataDir), 'utf-8')));
  const archivedTrackIds = collectArchivedTrackIds(archiveSummaries);

  const queue = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf-8')).tracks : [];

  const result = await run({
    token,
    userId,
    queue,
    archivedTrackIds,
    fetchLikedSongs,
    fetchAllPlaylists,
    fetchPlaylistTracks,
    createPlaylist: dryRun
      ? async (t, u, name) => {
          console.log(`[dry-run] would create playlist: ${name}`);
          return { id: `dry-run-${name}` };
        }
      : createPlaylist,
    addTracksToPlaylist: dryRun
      ? async (t, playlistId, uris) => {
          console.log(`[dry-run] would add ${uris.length} track(s) to ${playlistId}`);
        }
      : addTracksToPlaylist,
  });

  if (result.addedCount > 0 && !dryRun) {
    mkdirSync(dataDir, { recursive: true });
    await buildArchives({
      token,
      fetchAllPlaylists,
      fetchPlaylistTracks,
      writeFile: (name, contents) => writeFileSync(new URL(name, dataDir), contents),
    });
  }

  if (dryRun) {
    console.log(`[dry-run] would leave ${result.queue.length} pending track(s) in the ledger.`);
    return;
  }

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({ tracks: result.queue }, null, 2));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- archive-liked-songs`
Expected: PASS

- [ ] **Step 5: Add npm scripts**

In `package.json`, inside `"scripts"`, add (matching the existing `build-archives`/`authorize` entries' style):

```json
    "archive-liked-songs": "node scripts/archive-liked-songs.mjs",
    "archive-liked-songs:dry-run": "node scripts/archive-liked-songs.mjs --dry-run",
```

- [ ] **Step 6: Run the full test suite and the build**

Run: `npm test && npm run build`
Expected: All tests PASS; typecheck + Vite build succeed (this script isn't part of the TS app, but `npm run build` must still be unaffected).

- [ ] **Step 7: Commit**

```bash
git add scripts/archive-liked-songs.mjs scripts/archive-liked-songs.test.mjs package.json
git commit -m "$(cat <<'EOF'
Add archive-liked-songs orchestrator with dry-run support

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documentation — README and the weekly-agent skill

**Files:**
- Modify: `README.md`
- Create: `~/.claude/skills/archive-liked-songs/SKILL.md` (outside this repo — not a git commit target)

**Interfaces:**
- Consumes: `npm run archive-liked-songs` / `npm run archive-liked-songs:dry-run` (Task 5), `scripts/state/liked-songs-queue.json` (Task 5), `SCOPES` (Task 1).

- [ ] **Step 1: Add a section to `README.md`**

After the existing "## Regenerating the archive data" section, add:

```markdown
## Automating the weekly archive move

`npm run archive-liked-songs` is the automated version of "like 30 songs →
make a playlist → move them → rebuild the site":

1. Fetches Liked Songs incrementally — only pages until it reaches a track
   it's already seen, rather than the whole library every time.
2. Cross-references against `public/data/archive-*.json` to know what's
   already archived, and keeps everything else in a small committed
   ledger at `scripts/state/liked-songs-queue.json` — this ledger, not
   Spotify's live Liked Songs list, is the source of truth for "what's
   pending," since songs are intentionally never unliked.
3. Tops off the current open "Digital Archive #NNN" playlist, then opens
   new ones (30 tracks each) as long as enough pending songs remain.
4. Regenerates `public/data/*.json` using the same logic as
   `build-archives`.

Run `npm run archive-liked-songs:dry-run` first to see what it *would* do
(no Spotify writes, no file writes, just log output) before running it for
real.

Requires the `user-library-read` and `playlist-modify-public` scopes — if
`.env` was set up before this feature existed, re-run `npm run authorize`
once to pick them up.

Ordinarily this runs weekly via a scheduled Claude Code agent rather than
by hand.
```

- [ ] **Step 2: Create the weekly-agent skill**

Create `~/.claude/skills/archive-liked-songs/SKILL.md`:

```markdown
---
name: archive-liked-songs
description: Weekly automation that moves Pedro's newest liked Spotify songs into "Digital Archive #NNN" playlists once enough accumulate, then syncs the digital-archives website. Use when running the scheduled weekly liked-songs archive check, or when Pedro asks to run it manually.
---

# Archive liked songs

`~/personal_projects/digital-archives` automates Pedro's "like songs → seal a
30-song playlist → rebuild the site" process. This skill runs that
automation end to end: move newly-liked songs into archive playlists, then
sync the site data — the write counterpart to `sync-digital-archives`'s
read-only regeneration.

## Run the archive move

```bash
cd ~/personal_projects/digital-archives && npm run archive-liked-songs
```

This:
- Reads Liked Songs from Spotify (incrementally) and updates the pending
  ledger at `scripts/state/liked-songs-queue.json`.
- Tops off the current open "Digital Archive #NNN" playlist, and creates
  new ones (30 tracks each) as long as 30 or more pending songs remain.
- Regenerates `public/data/*.json` if anything was added.

Requires `SPOTIFY_REFRESH_TOKEN` in `.env` with the `user-library-read` and
`playlist-modify-public` scopes. **If it fails asking for authorization or
insufficient scope, tell Pedro rather than trying to redo the OAuth flow
yourself** — it requires him to open a browser URL and approve access
(same rule as `sync-digital-archives`).

If anything about the run looks unexpected (an error, an unusually large
batch, zero pending songs when some were expected), run `npm run
archive-liked-songs:dry-run` first to see the plan without making any
changes, and check with Pedro before proceeding.

## Verify before committing

```bash
cd ~/personal_projects/digital-archives && npm run build
```

Confirms the regenerated JSON still matches what the components expect.

## Commit and push

Only commit if something actually changed
(`git -C ~/personal_projects/digital-archives status`) — most weekly runs
will touch only the ledger (or nothing at all, if no new songs were
liked).

```bash
git -C ~/personal_projects/digital-archives add public/data scripts/state/liked-songs-queue.json \
  && git -C ~/personal_projects/digital-archives commit -m "$(cat <<'EOF'
Archive liked songs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git -C ~/personal_projects/digital-archives push origin main
```

## Report

Tell Pedro: how many songs were newly synced from Liked Songs, whether any
archive was topped off or newly created (and which numbers), how many
songs are still pending, and confirm the push succeeded — or, if nothing
changed, say so plainly rather than treating a null diff as an error.
```

- [ ] **Step 3: Commit the README change (the skill file is outside the repo and isn't committed here)**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document the liked-songs archive automation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Manual end-to-end verification (requires Pedro)

This task has no code changes — it validates Tasks 1-6 against the real Spotify API and flags the one assumption (Task 2's `track` vs `item` key) that couldn't be checked during planning. **Do not run the live (non-dry-run) command without Pedro's explicit go-ahead** — it writes to his real, public playlists and can push to the public repo.

- [ ] **Step 1: Ask Pedro to re-run authorization**

The refresh token in `.env` predates the Task 1 scope changes. Ask Pedro to run:

```bash
cd ~/personal_projects/digital-archives && npm run authorize
```

...and complete the browser approval + code exchange steps printed by the script (same flow documented in `README.md`'s "One-time authorization" section). Do not attempt this yourself — it requires Pedro's Spotify login in a browser.

- [ ] **Step 2: Run the full test suite one more time**

Run: `npm test && npm run build && npm run lint`
Expected: everything passes.

- [ ] **Step 3: Dry run against the real account**

```bash
npm run archive-liked-songs:dry-run
```

Inspect the log output: does it report a sensible number of newly-synced Liked Songs? Does the top-off/new-archive plan look right given archive #29 currently has 22/30 tracks? If `fetchLikedSongs` reports 0 synced songs when Pedro knows he has unarchived likes, that's the `track`-vs-`item` key assumption from Task 2 being wrong — fix `fetchLikedSongs` to use whatever key a quick real fetch shows (e.g., temporarily log `JSON.stringify(page.items[0])` from a manual one-off script) before proceeding.

- [ ] **Step 4: Confirm with Pedro, then run for real**

Show Pedro the dry-run output. Only after he confirms, run:

```bash
npm run archive-liked-songs
```

- [ ] **Step 5: Verify the results**

Check `git status` — `public/data/*.json` and `scripts/state/liked-songs-queue.json` should reflect the run. Spot-check on Spotify (or via `open https://open.spotify.com/playlist/<id>`) that the expected playlist(s) actually received the tracks. Then follow Task 6's skill to commit and push, and report the outcome to Pedro.

---

### Task 8: Schedule the weekly agent

Requires Task 7 complete and Pedro's go-ahead to start unattended weekly writes to his Spotify account and public repo.

- [ ] **Step 1: Invoke the `schedule` skill**

Use it to create a weekly scheduled cloud agent (e.g., Monday mornings) whose prompt runs the `archive-liked-songs` skill from Task 6: run the archive move, verify, commit + push if changed, and report back to Pedro — surfacing (never silently retrying) any authorization failure.

- [ ] **Step 2: Confirm the schedule with Pedro**

Report back the configured cadence and next run time, and remind him that failures (e.g., an expired refresh token) will be reported, not silently retried, and will need `npm run authorize` re-run by him.
