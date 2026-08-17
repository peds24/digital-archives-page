import { describe, it, expect, vi } from 'vitest';
import {
  getClientCredentialsToken,
  spotifyFetch,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  getAccessTokenFromRefreshToken,
} from './spotify-client.mjs';

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

  it('throws after exhausting 5 retries on repeated 429s', async () => {
    const fakeFetch = vi.fn();
    // Mock 6 consecutive 429 responses with Retry-After: 0
    for (let i = 0; i < 6; i++) {
      fakeFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map([['Retry-After', '0']]),
      });
    }
    await expect(spotifyFetch('tok', '/me', fakeFetch)).rejects.toThrow(
      'Spotify API rate limit exceeded after 5 retries: /me'
    );
    // Should have called fetch 5 times (initial + 4 retries before hitting the cap)
    expect(fakeFetch).toHaveBeenCalledTimes(5);
  });
});

describe('buildAuthorizeUrl', () => {
  it('builds a URL with client id, response_type, redirect_uri, and space-joined url-encoded scopes', () => {
    const url = buildAuthorizeUrl({
      clientId: 'abc123',
      redirectUri: 'http://127.0.0.1:8888/callback',
      scopes: ['playlist-read-private', 'playlist-read-collaborative'],
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('abc123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:8888/callback');
    expect(parsed.searchParams.get('scope')).toBe('playlist-read-private playlist-read-collaborative');
    // scope is url-encoded with a literal + or %20 for the space in the raw query string
    expect(url).toMatch(/scope=playlist-read-private(%20|\+)playlist-read-collaborative/);
  });
});

describe('exchangeAuthorizationCode', () => {
  it('POSTs a grant_type=authorization_code request and returns accessToken/refreshToken', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'access-1', refresh_token: 'refresh-1' }),
    });

    const result = await exchangeAuthorizationCode(
      {
        clientId: 'id',
        clientSecret: 'secret',
        code: 'auth-code',
        redirectUri: 'http://127.0.0.1:8888/callback',
      },
      fakeFetch
    );

    expect(result).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, options] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(options.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:8888/callback');
  });

  it('throws when the exchange request fails', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    await expect(
      exchangeAuthorizationCode(
        { clientId: 'id', clientSecret: 'secret', code: 'bad-code', redirectUri: 'http://127.0.0.1:8888/callback' },
        fakeFetch
      )
    ).rejects.toThrow('Spotify authorization code exchange failed: 400');
  });
});

describe('getAccessTokenFromRefreshToken', () => {
  it('POSTs a grant_type=refresh_token request and returns just the access token', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'access-2' }),
    });

    const token = await getAccessTokenFromRefreshToken(
      { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh-1' },
      fakeFetch
    );

    expect(token).toBe('access-2');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, options] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
    const body = new URLSearchParams(options.body);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-1');
  });

  it('throws when the refresh request fails', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      getAccessTokenFromRefreshToken({ clientId: 'id', clientSecret: 'secret', refreshToken: 'bad' }, fakeFetch)
    ).rejects.toThrow('Spotify refresh token request failed: 401');
  });
});
