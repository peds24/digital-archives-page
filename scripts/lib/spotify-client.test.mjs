import { describe, it, expect, vi } from 'vitest';
import { getClientCredentialsToken, spotifyFetch } from './spotify-client.mjs';

describe('getClientCredentialsToken', () => {
  it('returns the access token on success', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'id';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'token-123' }),
    });
    const token = await getClientCredentialsToken(fakeFetch);
    expect(token).toBe('token-123');
  });

  it('throws when credentials are missing', async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    await expect(getClientCredentialsToken(vi.fn())).rejects.toThrow(
      'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set'
    );
  });
});

describe('spotifyFetch', () => {
  it('retries once on 429 then succeeds', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, ok: false, headers: new Map([['Retry-After', '0']]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'abc' }) });
    const result = await spotifyFetch('tok', '/me', fakeFetch);
    expect(result).toEqual({ id: 'abc' });
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on a non-retryable error status', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Map() });
    await expect(spotifyFetch('tok', '/missing', fakeFetch)).rejects.toThrow(
      'Spotify API request failed (404): /missing'
    );
  });
});
