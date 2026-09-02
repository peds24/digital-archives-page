import { describe, it, expect } from 'vitest';
import { upsertEnvLine, SCOPES } from './authorize.mjs';

describe('upsertEnvLine', () => {
  it('writes a fresh line when the file is empty/nonexistent (contents === "")', () => {
    const result = upsertEnvLine('', 'SPOTIFY_REFRESH_TOKEN', 'abc123');
    expect(result).toBe('SPOTIFY_REFRESH_TOKEN=abc123');
  });

  it('appends onto a file that already ends with a trailing newline, without leaving a blank line', () => {
    const contents = 'SPOTIFY_CLIENT_ID=id\nSPOTIFY_CLIENT_SECRET=secret\n';
    const result = upsertEnvLine(contents, 'SPOTIFY_REFRESH_TOKEN', 'abc123');
    expect(result).toBe('SPOTIFY_CLIENT_ID=id\nSPOTIFY_CLIENT_SECRET=secret\nSPOTIFY_REFRESH_TOKEN=abc123');
  });

  it('appends onto a file with no trailing newline', () => {
    const contents = 'SPOTIFY_CLIENT_ID=id\nSPOTIFY_CLIENT_SECRET=secret';
    const result = upsertEnvLine(contents, 'SPOTIFY_REFRESH_TOKEN', 'abc123');
    expect(result).toBe('SPOTIFY_CLIENT_ID=id\nSPOTIFY_CLIENT_SECRET=secret\nSPOTIFY_REFRESH_TOKEN=abc123');
  });

  it('replaces an existing SPOTIFY_REFRESH_TOKEN= line in place instead of duplicating it', () => {
    const contents = 'SPOTIFY_CLIENT_ID=id\nSPOTIFY_REFRESH_TOKEN=old-token\nSPOTIFY_CLIENT_SECRET=secret\n';
    const result = upsertEnvLine(contents, 'SPOTIFY_REFRESH_TOKEN', 'new-token');
    expect(result).toBe('SPOTIFY_CLIENT_ID=id\nSPOTIFY_REFRESH_TOKEN=new-token\nSPOTIFY_CLIENT_SECRET=secret\n');
    // Only one line for the key, never duplicated
    expect(result.match(/SPOTIFY_REFRESH_TOKEN=/g)).toHaveLength(1);
  });
});

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

  it('includes ugc-image-upload, needed to set custom playlist cover art', () => {
    expect(SCOPES).toContain('ugc-image-upload');
  });
});
