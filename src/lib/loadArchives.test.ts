import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAllArchives } from './loadArchives';
import type { ArchiveIndex, ArchiveDetail } from './types';

describe('loadAllArchives', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the index, fetches each archive detail, and flattens tracks into trackPool with archiveId and archiveNumber attached', async () => {
    const mockIndex: ArchiveIndex = {
      archives: [
        {
          id: 'archive-001',
          number: 1,
          trackCount: 2,
          inProgress: false,
          dateRange: { earliest: '2026-04-29T17:58:28Z', latest: '2026-04-29T17:58:28Z' },
        },
        {
          id: 'archive-002',
          number: 2,
          trackCount: 1,
          inProgress: false,
          dateRange: { earliest: '2022-06-01T06:35:28Z', latest: '2022-06-01T06:37:24Z' },
        },
      ],
    };

    const mockArchive001: ArchiveDetail = {
      id: 'archive-001',
      number: 1,
      trackCount: 2,
      inProgress: false,
      dateRange: { earliest: '2026-04-29T17:58:28Z', latest: '2026-04-29T17:58:28Z' },
      tracks: [
        {
          id: 'track-001',
          name: 'Song One',
          artists: ['Artist One'],
          album: 'Album One',
          coverUrl: 'https://example.com/cover1.jpg',
          releaseDate: '2020-01-01',
          durationMs: 180000,
          addedAt: '2026-04-29T17:58:28Z',
          spotifyUrl: 'https://open.spotify.com/track/track-001',
          unavailable: false,
        },
        {
          id: 'track-002',
          name: 'Song Two',
          artists: ['Artist Two'],
          album: 'Album Two',
          coverUrl: 'https://example.com/cover2.jpg',
          releaseDate: '2021-01-01',
          durationMs: 200000,
          addedAt: '2026-04-29T17:58:28Z',
          spotifyUrl: 'https://open.spotify.com/track/track-002',
          unavailable: false,
        },
      ],
    };

    const mockArchive002: ArchiveDetail = {
      id: 'archive-002',
      number: 2,
      trackCount: 1,
      inProgress: false,
      dateRange: { earliest: '2022-06-01T06:35:28Z', latest: '2022-06-01T06:37:24Z' },
      tracks: [
        {
          id: 'track-003',
          name: 'Song Three',
          artists: ['Artist Three'],
          album: 'Album Three',
          coverUrl: 'https://example.com/cover3.jpg',
          releaseDate: '2022-01-01',
          durationMs: 220000,
          addedAt: '2022-06-01T06:35:28Z',
          spotifyUrl: 'https://open.spotify.com/track/track-003',
          unavailable: false,
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/data/index.json') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIndex),
          });
        } else if (url === '/data/archive-001.json') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockArchive001),
          });
        } else if (url === '/data/archive-002.json') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockArchive002),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      })
    );

    const result = await loadAllArchives('/data');

    expect(result.archives).toHaveLength(2);
    expect(result.archives[0].id).toBe('archive-001');
    expect(result.archives[1].id).toBe('archive-002');

    expect(result.trackPool).toHaveLength(3);

    // Verify archiveId and archiveNumber are attached
    expect(result.trackPool[0]).toMatchObject({
      id: 'track-001',
      name: 'Song One',
      archiveId: 'archive-001',
      archiveNumber: 1,
    });

    expect(result.trackPool[1]).toMatchObject({
      id: 'track-002',
      name: 'Song Two',
      archiveId: 'archive-001',
      archiveNumber: 1,
    });

    expect(result.trackPool[2]).toMatchObject({
      id: 'track-003',
      name: 'Song Three',
      archiveId: 'archive-002',
      archiveNumber: 2,
    });
  });

  it('throws with a clear error message when the index fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/data/index.json') {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      })
    );

    await expect(loadAllArchives('/data')).rejects.toThrow('Failed to load archive index: 404');
  });
});
