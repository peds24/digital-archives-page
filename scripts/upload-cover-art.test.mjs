import { describe, it, expect, vi } from 'vitest';
import { run } from './upload-cover-art.mjs';

describe('run', () => {
  it('renders and uploads a cover for each Digital Archive playlist, in ascending order', async () => {
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);
    const renderCoverArt = vi.fn((n) => Buffer.from(`jpeg-${n}`));
    const fetchAllPlaylists = vi.fn().mockResolvedValue([
      { id: 'pl2', name: 'Digital Archive #2' },
      { id: 'pl1', name: 'Digital Archive #1' },
      { id: 'other', name: 'Some Other Playlist' },
    ]);

    const result = await run({
      token: 'tok',
      numbers: null,
      fetchAllPlaylists,
      renderCoverArt,
      uploadPlaylistCoverImage,
      delay: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    expect(renderCoverArt.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(uploadPlaylistCoverImage).toHaveBeenNthCalledWith(1, 'tok', 'pl1', Buffer.from('jpeg-1').toString('base64'));
    expect(uploadPlaylistCoverImage).toHaveBeenNthCalledWith(2, 'tok', 'pl2', Buffer.from('jpeg-2').toString('base64'));
    expect(result).toEqual({ uploadedCount: 2 });
  });

  it('restricts to the given archive numbers when provided', async () => {
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);
    const fetchAllPlaylists = vi.fn().mockResolvedValue([
      { id: 'pl1', name: 'Digital Archive #1' },
      { id: 'pl2', name: 'Digital Archive #2' },
    ]);

    const result = await run({
      token: 'tok',
      numbers: [2],
      fetchAllPlaylists,
      renderCoverArt: vi.fn(() => Buffer.from('jpeg')),
      uploadPlaylistCoverImage,
      delay: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(1);
    expect(uploadPlaylistCoverImage).toHaveBeenCalledWith('tok', 'pl2', expect.any(String));
    expect(result).toEqual({ uploadedCount: 1 });
  });

  it('delays between uploads but not after the last one', async () => {
    const delay = vi.fn().mockResolvedValue(undefined);
    const fetchAllPlaylists = vi.fn().mockResolvedValue([
      { id: 'pl1', name: 'Digital Archive #1' },
      { id: 'pl2', name: 'Digital Archive #2' },
    ]);

    await run({
      token: 'tok',
      numbers: null,
      fetchAllPlaylists,
      renderCoverArt: vi.fn(() => Buffer.from('jpeg')),
      uploadPlaylistCoverImage: vi.fn().mockResolvedValue(undefined),
      delay,
      log: vi.fn(),
    });

    expect(delay).toHaveBeenCalledTimes(1);
  });

  it('skips archives already in uploadedNumbers', async () => {
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);
    const fetchAllPlaylists = vi.fn().mockResolvedValue([
      { id: 'pl1', name: 'Digital Archive #1' },
      { id: 'pl2', name: 'Digital Archive #2' },
      { id: 'pl3', name: 'Digital Archive #3' },
    ]);

    const result = await run({
      token: 'tok',
      numbers: null,
      uploadedNumbers: new Set([1, 2]),
      fetchAllPlaylists,
      renderCoverArt: vi.fn(() => Buffer.from('jpeg')),
      uploadPlaylistCoverImage,
      delay: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(1);
    expect(uploadPlaylistCoverImage).toHaveBeenCalledWith('tok', 'pl3', expect.any(String));
    expect(result).toEqual({ uploadedCount: 1 });
  });

  it('an explicit --number overrides uploadedNumbers, re-uploading an already-covered archive', async () => {
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);
    const fetchAllPlaylists = vi.fn().mockResolvedValue([{ id: 'pl1', name: 'Digital Archive #1' }]);

    const result = await run({
      token: 'tok',
      numbers: [1],
      uploadedNumbers: new Set([1]),
      fetchAllPlaylists,
      renderCoverArt: vi.fn(() => Buffer.from('jpeg')),
      uploadPlaylistCoverImage,
      delay: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ uploadedCount: 1 });
  });

  it('calls onUploaded synchronously after each success, before the next item can fail', async () => {
    const onUploaded = vi.fn();
    const fetchAllPlaylists = vi.fn().mockResolvedValue([
      { id: 'pl1', name: 'Digital Archive #1' },
      { id: 'pl2', name: 'Digital Archive #2' },
    ]);
    const uploadPlaylistCoverImage = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Spotify API request failed (401): /playlists/pl2/images'));

    await expect(
      run({
        token: 'tok',
        numbers: null,
        fetchAllPlaylists,
        renderCoverArt: vi.fn(() => Buffer.from('jpeg')),
        uploadPlaylistCoverImage,
        onUploaded,
        delay: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })
    ).rejects.toThrow('401');

    // archive #1 succeeded and must be recorded even though #2 then failed
    expect(onUploaded).toHaveBeenCalledTimes(1);
    expect(onUploaded).toHaveBeenCalledWith(1);
  });
});
